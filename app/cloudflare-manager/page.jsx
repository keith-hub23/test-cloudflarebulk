"use client";
import React from "react";

function MainComponent() {
  const [apiKey, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const handleAuthenticate = useCallback(
    (e) => {
      e.preventDefault();
      fetchZones();
    },
    [fetchZones]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-cloud text-[#f6821f] text-2xl mr-2"></i>
              <h1 className="text-xl font-bold text-gray-900 font-roboto">
                Cloudflare Manager
              </h1>
            </div>
            {isAuthenticated && (
              <span className="text-sm text-gray-500">{email}</span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAuthenticated ? (
          <UnnamedProject
            title="Authentication"
            apiKey={apiKey}
            email={email}
            loading={loading}
            onApiKeyChange={(e) => setApiKey(e.target.value)}
            onEmailChange={(e) => setEmail(e.target.value)}
            onSubmit={handleAuthenticate}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 font-roboto">
                  Zones
                </h2>
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

            <div className="md:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 font-roboto">
                  {selectedZone
                    ? `DNS Records - ${selectedZone.name}`
                    : "Select a zone"}
                </h2>
                {selectedZone && (
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
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default MainComponent;