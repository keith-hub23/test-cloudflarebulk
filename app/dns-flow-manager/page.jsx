"use client";
import React from "react";

function MainComponent() {
  const [domains, setDomains] = useState("");
  const [selectedRecordType, setSelectedRecordType] = useState("A");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [dnsRecords, setDnsRecords] = useState([]);
  const [showDnsForm, setShowDnsForm] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const recordTypes = [
    { value: "A", label: "A Record (IPv4)" },
    { value: "AAAA", label: "AAAA Record (IPv6)" },
    { value: "CNAME", label: "CNAME Record" },
    { value: "MX", label: "MX Record" },
    { value: "TXT", label: "TXT Record" },
  ];

  const flowSteps = [
    { id: 0, title: "Input Domain", icon: "fa-globe" },
    { id: 1, title: "DNS Records", icon: "fa-list" },
    { id: 2, title: "Verify DNS", icon: "fa-check-circle" },
    { id: 3, title: "Configure Records", icon: "fa-cog" },
    { id: 4, title: "Apply Changes", icon: "fa-cloud-upload" },
  ];

  // Handle file upload for DNS records
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".txt")) {
      setError("Please upload a .txt file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const lines = content.split("\n").filter((line) => line.trim());
        const records = [];

        lines.forEach((line, index) => {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            const record = {
              id: Date.now() + index,
              type: parts[0].toUpperCase(),
              name: parts[1],
              content: parts.slice(2).join(" "),
              ttl: 300,
              proxied: false,
            };

            // Handle CNAME specific fields
            if (record.type === "CNAME") {
              record.target = record.content;
            }

            records.push(record);
          }
        });

        setDnsRecords(records);
        setUploadedFile(file.name);
        setError(null);
        setActiveStep(1);
      } catch (err) {
        setError("Failed to parse DNS file: " + err.message);
      }
    };
    reader.readAsText(file);
  }, []);

  // Add new DNS record
  const addDnsRecord = useCallback(() => {
    const newRecord = {
      id: Date.now(),
      type: selectedRecordType,
      name: "",
      content: "",
      ttl: 300,
      proxied: false,
    };

    // Add CNAME specific fields
    if (selectedRecordType === "CNAME") {
      newRecord.target = "";
    }

    setDnsRecords((prev) => [...prev, newRecord]);
  }, [selectedRecordType]);

  // Update DNS record
  const updateDnsRecord = useCallback((id, field, value) => {
    setDnsRecords((prev) =>
      prev.map((record) =>
        record.id === id ? { ...record, [field]: value } : record
      )
    );
  }, []);

  // Remove DNS record
  const removeDnsRecord = useCallback((id) => {
    setDnsRecords((prev) => prev.filter((record) => record.id !== id));
  }, []);

  const handleDomainCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const domainList = domains.split("\n").filter((d) => d.trim());
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
      setActiveStep(3);
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
          DNS Flow Manager
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6 font-roboto">
                DNS Management Flow
              </h2>

              <div className="flex flex-nowrap overflow-x-auto pb-4">
                {flowSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex-none px-4 relative min-w-[150px]"
                  >
                    <div
                      className={`flex flex-col items-center ${
                        activeStep >= step.id
                          ? "text-[#f6821f]"
                          : "text-gray-400"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center mb-2">
                        <i className={`fas ${step.icon}`}></i>
                      </div>
                      <span className="text-sm text-center">{step.title}</span>
                    </div>
                    {index < flowSteps.length - 1 && (
                      <div className="absolute top-5 left-[calc(50%+40px)] w-[calc(100%-80px)] h-[2px] bg-gray-200">
                        <div
                          className={`h-full ${
                            activeStep > step.id ? "bg-[#f6821f]" : ""
                          }`}
                        ></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Domain Input Section */}
            <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
              <h2 className="text-xl font-semibold mb-6 font-roboto">
                Domain Configuration
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Domains (one per line)
                  </label>
                  <textarea
                    name="domains"
                    value={domains}
                    onChange={(e) => setDomains(e.target.value)}
                    className="w-full h-32 p-3 border rounded-md"
                    placeholder="example.com"
                  ></textarea>
                </div>

                <button
                  onClick={() => setActiveStep(1)}
                  disabled={!domains.trim()}
                  className="w-full bg-[#f6821f] hover:bg-[#da7116] text-white py-3 px-4 rounded-md transition-colors disabled:bg-gray-300"
                >
                  <i className="fas fa-arrow-right mr-2"></i>
                  Continue to DNS Records
                </button>
              </div>
            </div>

            {/* DNS Records Section */}
            {activeStep >= 1 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mt-8">
                <h2 className="text-xl font-semibold mb-6 font-roboto">
                  DNS Records Configuration
                </h2>

                {/* File Upload Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6">
                  <div className="text-center">
                    <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Upload DNS Records File
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload a .txt file with DNS records (Format: TYPE NAME
                      CONTENT)
                    </p>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="dns-file-upload"
                    />
                    <label
                      htmlFor="dns-file-upload"
                      className="bg-[#f6821f] hover:bg-[#da7116] text-white px-4 py-2 rounded-md cursor-pointer transition-colors"
                    >
                      <i className="fas fa-upload mr-2"></i>
                      Choose File
                    </label>
                    {uploadedFile && (
                      <p className="text-sm text-green-600 mt-2">
                        <i className="fas fa-check mr-1"></i>
                        Uploaded: {uploadedFile}
                      </p>
                    )}
                  </div>
                </div>

                {/* Manual DNS Record Entry */}
                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Manual DNS Records</h3>
                    <div className="flex gap-2">
                      <select
                        value={selectedRecordType}
                        onChange={(e) => setSelectedRecordType(e.target.value)}
                        className="p-2 border rounded-md"
                      >
                        {recordTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={addDnsRecord}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
                      >
                        <i className="fas fa-plus mr-2"></i>
                        Add Record
                      </button>
                    </div>
                  </div>

                  {/* DNS Records List */}
                  <div className="space-y-4">
                    {dnsRecords.map((record) => (
                      <div
                        key={record.id}
                        className="border rounded-lg p-4 bg-gray-50"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                          {/* Type */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Type
                            </label>
                            <select
                              value={record.type}
                              onChange={(e) =>
                                updateDnsRecord(
                                  record.id,
                                  "type",
                                  e.target.value
                                )
                              }
                              className="w-full p-2 border rounded-md text-sm"
                            >
                              {recordTypes.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.value}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Name */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Name
                            </label>
                            <input
                              type="text"
                              value={record.name}
                              onChange={(e) =>
                                updateDnsRecord(
                                  record.id,
                                  "name",
                                  e.target.value
                                )
                              }
                              className="w-full p-2 border rounded-md text-sm"
                              placeholder="@, www, mail"
                            />
                          </div>

                          {/* Content/Target */}
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              {record.type === "CNAME" ? "Target" : "Content"}
                            </label>
                            <input
                              type="text"
                              value={
                                record.type === "CNAME"
                                  ? record.target || ""
                                  : record.content
                              }
                              onChange={(e) => {
                                const field =
                                  record.type === "CNAME"
                                    ? "target"
                                    : "content";
                                updateDnsRecord(
                                  record.id,
                                  field,
                                  e.target.value
                                );
                                if (record.type === "CNAME") {
                                  updateDnsRecord(
                                    record.id,
                                    "content",
                                    e.target.value
                                  );
                                }
                              }}
                              className="w-full p-2 border rounded-md text-sm"
                              placeholder={
                                record.type === "CNAME"
                                  ? "target.example.com"
                                  : "Record content"
                              }
                            />
                          </div>

                          {/* Proxy Status (for proxiable records) */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Proxy Status
                            </label>
                            {record.type === "A" ||
                            record.type === "AAAA" ||
                            record.type === "CNAME" ? (
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`text-xs ${
                                    !record.proxied
                                      ? "text-gray-600"
                                      : "text-gray-400"
                                  }`}
                                >
                                  DNS
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDnsRecord(
                                      record.id,
                                      "proxied",
                                      !record.proxied
                                    )
                                  }
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#f6821f] focus:ring-offset-2 ${
                                    record.proxied
                                      ? "bg-[#f6821f]"
                                      : "bg-gray-200"
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                      record.proxied
                                        ? "translate-x-5"
                                        : "translate-x-1"
                                    }`}
                                  />
                                </button>
                                <span
                                  className={`text-xs ${
                                    record.proxied
                                      ? "text-[#f6821f] font-medium"
                                      : "text-gray-400"
                                  }`}
                                >
                                  Proxy
                                </span>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 py-2">
                                Not available
                              </div>
                            )}
                          </div>

                          {/* TTL */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              TTL
                            </label>
                            <select
                              value={record.ttl}
                              onChange={(e) =>
                                updateDnsRecord(
                                  record.id,
                                  "ttl",
                                  parseInt(e.target.value)
                                )
                              }
                              className="w-full p-2 border rounded-md text-sm"
                            >
                              <option value={1}>Auto</option>
                              <option value={300}>5 min</option>
                              <option value={600}>10 min</option>
                              <option value={1800}>30 min</option>
                              <option value={3600}>1 hour</option>
                              <option value={86400}>1 day</option>
                            </select>
                          </div>

                          {/* Actions */}
                          <div className="flex items-end">
                            <button
                              onClick={() => removeDnsRecord(record.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md transition-colors"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {dnsRecords.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        No DNS records configured. Upload a file or add records
                        manually.
                      </div>
                    )}
                  </div>

                  {dnsRecords.length > 0 && (
                    <div className="mt-6 flex gap-4">
                      <button
                        onClick={handleDomainCheck}
                        disabled={loading}
                        className="flex-1 bg-[#f6821f] hover:bg-[#da7116] text-white py-3 px-4 rounded-md transition-colors disabled:bg-gray-300"
                      >
                        {loading ? (
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                        ) : (
                          <i className="fas fa-check-circle mr-2"></i>
                        )}
                        Verify DNS Configuration
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6 font-roboto">
                Results
              </h2>

              {error && (
                <div className="p-4 bg-red-100 text-red-700 rounded-md mb-4">
                  {error}
                </div>
              )}

              {/* DNS Records Preview */}
              {dnsRecords.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium mb-3">
                    DNS Records ({dnsRecords.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {dnsRecords.map((record) => (
                      <div
                        key={record.id}
                        className="text-sm p-2 bg-gray-50 rounded border"
                      >
                        <div className="font-medium">
                          {record.type} - {record.name || "@"}
                        </div>
                        <div className="text-gray-600">
                          {record.type === "CNAME"
                            ? record.target
                            : record.content}
                          {record.type === "CNAME" && (
                            <span className="ml-2 text-xs">
                              ({record.proxied ? "Proxied" : "DNS Only"})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(results).length > 0 && (
                <div className="space-y-4">
                  {Object.entries(results).map(([domain, checks]) => (
                    <div key={domain} className="border rounded-md p-4">
                      <h3 className="font-medium mb-2">{domain}</h3>
                      <div className="space-y-2">
                        {Object.entries(checks).map(([check, passed]) => (
                          <div key={check} className="flex items-center">
                            <i
                              className={`fas fa-${
                                passed
                                  ? "check text-green-500"
                                  : "times text-red-500"
                              } mr-2`}
                            ></i>
                            <span className="capitalize">{check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!error &&
                Object.keys(results).length === 0 &&
                dnsRecords.length === 0 && (
                  <div className="text-gray-500 text-center py-4">
                    No results to display
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