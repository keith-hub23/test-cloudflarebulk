"use client";
import React from "react";

function MainComponent() {
  const [domains, setDomains] = useState("");
  const [dnsRecords, setDnsRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationResults, setValidationResults] = useState({});
  const [bulkDomains, setBulkDomains] = useState("");
  const [zones, setZones] = useState([]);
  const [progress, setProgress] = useState({});

  // Cloudflare credentials
  const API_KEY = "4128d868a78a4fe83b681413ccd8a27a6f1fd";
  const EMAIL = "glessa@teamclocking.com";

  const defaultDNSConfig = [
    { type: "A", name: "@", content: "192.0.2.1", ttl: 1 },
    { type: "A", name: "www", content: "192.0.2.1", ttl: 1 },
    { type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none;", ttl: 1 },
    {
      type: "TXT",
      name: "@",
      content: "v=spf1 include:_spf.google.com ~all",
      ttl: 1,
    },
    { type: "MX", name: "@", content: "smtp.google.com", priority: 1, ttl: 1 },
  ];

  // Fetch zones on component mount
  useEffect(() => {
    const fetchZones = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/cloudflare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "listZones",
            apiKey: API_KEY,
            email: EMAIL,
          }),
        });

        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }

        if (data.result) {
          setZones(data.result);
        }
      } catch (err) {
        setError("Failed to fetch zones: " + err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchZones();
  }, []);

  const handleBulkDomainAdd = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress({});

    const domainList = bulkDomains
      .split("\n")
      .filter((domain) => domain.trim())
      .map((domain) => domain.trim().toLowerCase());

    for (const domain of domainList) {
      setProgress((prev) => ({
        ...prev,
        [domain]: { status: "processing", message: "Creating zone..." },
      }));

      try {
        // First try to create the zone
        const createZoneResponse = await fetch("/api/cloudflare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createZone",
            apiKey: API_KEY,
            email: EMAIL,
            name: domain,
          }),
        });

        const zoneData = await createZoneResponse.json();
        if (zoneData.error && !zoneData.error.includes("already exists")) {
          throw new Error(zoneData.error);
        }

        // Get the zone ID (either from the new zone or existing one)
        let zoneId;
        if (zoneData.result) {
          zoneId = zoneData.result.id;
        } else {
          // If zone creation failed because it exists, find it in the zones list
          const existingZone = zones.find((z) => z.name === domain);
          if (existingZone) {
            zoneId = existingZone.id;
          } else {
            throw new Error("Could not create or find zone");
          }
        }

        // Add DNS records for the domain
        setProgress((prev) => ({
          ...prev,
          [domain]: { status: "processing", message: "Adding DNS records..." },
        }));

        for (const config of defaultDNSConfig) {
          setProgress((prev) => ({
            ...prev,
            [domain]: {
              status: "processing",
              message: `Adding ${config.type} record (${config.name})...`,
            },
          }));

          const response = await fetch("/api/cloudflare", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "createDNSRecord",
              apiKey: API_KEY,
              email: EMAIL,
              zoneId: zoneId,
              record: {
                ...config,
                name: config.name === "@" ? domain : `${config.name}.${domain}`,
              },
            }),
          });

          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }

          setDnsRecords((prev) => [
            ...prev,
            {
              ...config,
              domain,
              id: data.result.id,
            },
          ]);
        }

        // Refresh zones list to include new zone
        const zonesResponse = await fetch("/api/cloudflare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "listZones",
            apiKey: API_KEY,
            email: EMAIL,
          }),
        });

        const zonesData = await zonesResponse.json();
        if (zonesData.result) {
          setZones(zonesData.result);
        }

        setProgress((prev) => ({
          ...prev,
          [domain]: {
            status: "success",
            message: "Zone created and DNS records added successfully",
          },
        }));
      } catch (err) {
        setProgress((prev) => ({
          ...prev,
          [domain]: { status: "error", message: err.message },
        }));
        console.error(err);
      }
    }

    setLoading(false);
  }, [bulkDomains, zones]);

  const handleDownloadDomains = useCallback(() => {
    const domainList = bulkDomains
      .split("\n")
      .filter((domain) => domain.trim())
      .join("\n");

    const blob = new Blob([domainList], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domain-list.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [bulkDomains]);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBulkDomains(e.target.result);
      };
      reader.readAsText(file);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 font-roboto">
          Cloudflare DNS Manager
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              Bulk Add Domains with Default DNS
            </h2>

            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="flex-1 p-2 border rounded"
                />
                <button
                  onClick={handleDownloadDomains}
                  disabled={!bulkDomains.trim()}
                  className="bg-gray-600 text-white py-2 px-4 rounded hover:bg-gray-700 disabled:bg-gray-400"
                >
                  <i className="fas fa-download mr-2"></i>
                  Save List
                </button>
              </div>

              <textarea
                placeholder="Enter domains (one per line)"
                value={bulkDomains}
                onChange={(e) => setBulkDomains(e.target.value)}
                className="w-full h-40 p-2 border rounded mb-4"
                name="bulkDomains"
              ></textarea>

              <button
                onClick={handleBulkDomainAdd}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-400"
              >
                {loading
                  ? "Adding DNS Records..."
                  : "Add Domains with Default DNS"}
              </button>

              {/* Progress Display - Made more prominent */}
              {Object.keys(progress).length > 0 && (
                <div className="mt-4 border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold text-lg mb-3">Progress:</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {Object.entries(progress).map(
                      ([domain, { status, message }]) => (
                        <div
                          key={domain}
                          className={`p-3 rounded-lg shadow-sm flex items-center justify-between ${
                            status === "success"
                              ? "bg-green-100 text-green-700"
                              : status === "error"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          <span className="font-medium">{domain}</span>
                          <div className="flex items-center">
                            <span className="text-sm mr-2">{message}</span>
                            {status === "processing" && (
                              <i className="fas fa-spinner fa-spin"></i>
                            )}
                            {status === "success" && (
                              <i className="fas fa-check"></i>
                            )}
                            {status === "error" && (
                              <i className="fas fa-times"></i>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <h3 className="font-semibold">Default DNS Configuration:</h3>
                <pre className="bg-gray-50 p-3 rounded text-sm overflow-x-auto">
                  {`$TTL 1
@       IN  A     192.0.2.1
www     IN  A     192.0.2.1
_dmarc  IN  TXT   "v=DMARC1; p=none;"
@       IN  TXT   "v=spf1 include:_spf.google.com ~all"
@       IN  MX    1 smtp.google.com.`}
                </pre>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              DNS Records
            </h2>
            <div className="space-y-2">
              {dnsRecords.map((record) => (
                <div
                  key={record.id}
                  className="bg-gray-50 p-2 rounded mb-2 flex justify-between items-center"
                >
                  <span>
                    {record.domain} - {record.type}: {record.name} →{" "}
                    {record.content}{" "}
                    {record.priority ? `(Priority: ${record.priority})` : ""}{" "}
                    (TTL: {record.ttl})
                  </span>
                  <button
                    onClick={() => handleDeleteRecord(record)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              Available Zones
            </h2>
            <div className="space-y-2">
              {zones.map((zone) => (
                <div key={zone.id} className="p-2 bg-gray-50 rounded">
                  {zone.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;