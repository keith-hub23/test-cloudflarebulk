async function handler({
  action,
  zoneId,
  recordId,
  record,
  apiKey,
  email,
  name,
}) {
  if (!apiKey || !email) {
    return { error: "Missing authentication credentials" };
  }

  const baseUrl = "https://api.cloudflare.com/client/v4";
  const headers = {
    "X-Auth-Email": email,
    "X-Auth-Key": apiKey,
    "Content-Type": "application/json",
  };

  switch (action) {
    case "createZone":
      if (!name) {
        return { error: "Domain name is required" };
      }
      try {
        const response = await fetch(`${baseUrl}/zones`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name,
            account: { id: "your-account-id" }, // The user needs to replace this with their Cloudflare account ID
            type: "full",
          }),
        });
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: "Failed to create zone" };
      }

    case "listZones":
      try {
        const response = await fetch(`${baseUrl}/zones`, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: "Failed to fetch zones" };
      }

    case "listDNSRecords":
      if (!zoneId) {
        return { error: "Zone ID is required" };
      }
      try {
        const response = await fetch(`${baseUrl}/zones/${zoneId}/dns_records`, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: "Failed to fetch DNS records" };
      }

    case "createDNSRecord":
      if (!zoneId || !record) {
        return { error: "Zone ID and record details are required" };
      }
      try {
        const response = await fetch(`${baseUrl}/zones/${zoneId}/dns_records`, {
          method: "POST",
          headers,
          body: JSON.stringify(record),
        });
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: "Failed to create DNS record" };
      }

    case "updateDNSRecord":
      if (!zoneId || !recordId || !record) {
        return { error: "Zone ID, record ID, and record details are required" };
      }
      try {
        const response = await fetch(
          `${baseUrl}/zones/${zoneId}/dns_records/${recordId}`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify(record),
          }
        );
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: "Failed to update DNS record" };
      }

    case "deleteDNSRecord":
      if (!zoneId || !recordId) {
        return { error: "Zone ID and record ID are required" };
      }
      try {
        const response = await fetch(
          `${baseUrl}/zones/${zoneId}/dns_records/${recordId}`,
          {
            method: "DELETE",
            headers,
          }
        );
        const data = await response.json();
        return data;
      } catch (error) {
        return { error: "Failed to delete DNS record" };
      }

    default:
      return { error: "Invalid action" };
  }
}

function MainComponent() {
  const [apiKey, setApiKey] = useState("4128d868a78a4fe83b681413ccd8a27a6f1fd");
  const [email, setEmail] = useState("glessa@teamclocking.com");
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [bulkDomains, setBulkDomains] = useState("");
  const [progress, setProgress] = useState({});

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

  const fetchZones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cloudflare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "listZones",
          apiKey,
          email,
        }),
      });
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setZones(data.result || []);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [apiKey, email]);

  const fetchDNSRecords = useCallback(
    async (zoneId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/cloudflare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "listDNSRecords",
            zoneId,
            apiKey,
            email,
          }),
        });
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        setDnsRecords(data.result || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, email]
  );

  const handleZoneSelect = useCallback(
    (zone) => {
      setSelectedZone(zone);
      fetchDNSRecords(zone.id);
    },
    [fetchDNSRecords]
  );

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
            apiKey,
            email,
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
              apiKey,
              email,
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

        await fetchZones();

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
  }, [bulkDomains, zones, apiKey, email, fetchZones]);

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

  // Initial fetch of zones
  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-cloud text-[#f6821f] text-2xl mr-2"></i>
              <h1 className="text-xl font-bold text-gray-900 font-roboto">
                Cloudflare DNS Manager
              </h1>
            </div>
            {isAuthenticated && (
              <span className="text-sm text-gray-500">{email}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Zones */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 font-roboto">Zones</h2>
              <div className="space-y-2">
                {zones.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => handleZoneSelect(zone)}
                    className={`w-full text-left px-4 py-2 rounded-md transition-colors ${
                      selectedZone?.id === zone.id
                        ? "bg-[#f6821f] text-white"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {zone.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
            {/* Bulk Domain Management */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
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
                  className="w-full bg-[#f6821f] hover:bg-[#da7116] text-white py-2 px-4 rounded transition-colors disabled:bg-[#ffa15f]"
                >
                  {loading
                    ? "Adding DNS Records..."
                    : "Add Domains with Default DNS"}
                </button>

                {/* Progress Display */}
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

                {/* Default DNS Configuration Display */}
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

            {/* DNS Records Display */}
            {selectedZone && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 font-roboto">
                  DNS Records - {selectedZone.name}
                </h2>
                <div className="space-y-4">
                  {dnsRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-md"
                    >
                      <div>
                        <div className="font-medium">{record.name}</div>
                        <div className="text-sm text-gray-500">
                          {record.type} | {record.content}
                          {record.priority
                            ? ` | Priority: ${record.priority}`
                            : ""}
                          {` | TTL: ${record.ttl}`}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button className="text-gray-600 hover:text-gray-800">
                          <i className="fas fa-edit"></i>
                        </button>
                        <button className="text-red-600 hover:text-red-800">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
export async function POST(request) {
  return handler(await request.json());
}