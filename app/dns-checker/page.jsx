"use client";
import React from "react";

function MainComponent() {
  const [domains, setDomains] = useState("");
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const domainList = domains
        .split("\n")
        .map((d) => d.trim())
        .filter((d) => d);

      const response = await fetch("/api/check-dns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: domainList }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError("Failed to check DNS: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [domains]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 font-roboto">
          DNS Checker
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              Enter Domains
            </h2>
            <div className="space-y-4">
              <textarea
                name="domains"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className="w-full h-48 p-3 border rounded-md"
                placeholder="Enter domains (one per line)&#10;example.com&#10;example.org"
              ></textarea>

              <button
                onClick={handleCheck}
                disabled={loading || !domains.trim()}
                className="w-full bg-[#f6821f] hover:bg-[#da7116] text-white py-3 px-4 rounded-md transition-colors disabled:bg-gray-300"
              >
                {loading ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-search mr-2"></i>
                )}
                Check DNS Configuration
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              DNS Results
            </h2>

            {error && (
              <div className="p-4 bg-red-100 text-red-700 rounded-md mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {Object.entries(results).map(([domain, result]) => (
                <div key={domain} className="border rounded-lg p-4">
                  <h3 className="font-medium text-lg mb-3">{domain}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center">
                      <i
                        className={`fas fa-${
                          result.spf
                            ? "check text-green-500"
                            : "times text-red-500"
                        } mr-2`}
                      ></i>
                      <span>SPF Record</span>
                    </div>
                    <div className="flex items-center">
                      <i
                        className={`fas fa-${
                          result.dmarc
                            ? "check text-green-500"
                            : "times text-red-500"
                        } mr-2`}
                      ></i>
                      <span>DMARC Record</span>
                    </div>
                    <div className="flex items-center">
                      <i
                        className={`fas fa-${
                          result.mx
                            ? "check text-green-500"
                            : "times text-red-500"
                        } mr-2`}
                      ></i>
                      <span>MX Records</span>
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-list-ol mr-2 text-gray-600"></i>
                      <span>Total Records: {result.recordCount}</span>
                    </div>
                  </div>
                </div>
              ))}

              {!error && Object.keys(results).length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No results to display. Enter domains and click check to begin.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;