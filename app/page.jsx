"use client";
"use client";
import React, { useState, useEffect, useCallback } from "react";

function MainComponent() {
  const [domains, setDomains] = useState("");
  const [apiTokens, setApiTokens] = useState([""]);
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({});
  const [darkMode, setDarkMode] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState("Ibutang ang URL diri boss");
  const [createPageRules, setCreatePageRules] = useState(true);
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");

  const [dnsTemplate, setDnsTemplate] = useState([
    { type: "A", name: "@", content: "192.0.2.1", ttl: 1, enabled: true },
    { type: "A", name: "www", content: "192.0.2.1", ttl: 1, enabled: true },
    {
      type: "TXT",
      name: "_dmarc",
      content: "v=DMARC1; p=none;",
      ttl: 1,
      enabled: true,
    },
    {
      type: "TXT",
      name: "@",
      content: "v=spf1 include:_spf.google.com ~all",
      ttl: 1,
      enabled: true,
    },
    {
      type: "MX",
      name: "@",
      content: "smtp.google.com",
      priority: 1,
      ttl: 1,
      enabled: true,
    },
  ]);

  useEffect(() => {
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode) {
      setDarkMode(JSON.parse(savedMode));
    }

    const savedTemplatesData = localStorage.getItem("dnsTemplates");
    if (savedTemplatesData) {
      setSavedTemplates(JSON.parse(savedTemplatesData));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  const getCurrentApiToken = useCallback(() => {
    return apiTokens[currentTokenIndex] || apiTokens[0] || "";
  }, [apiTokens, currentTokenIndex]);

  const rotateApiToken = useCallback(() => {
    if (apiTokens.length > 1) {
      setCurrentTokenIndex((prev) => (prev + 1) % apiTokens.length);
    }
  }, [apiTokens.length]);

  const addApiToken = useCallback(() => {
    setApiTokens((prev) => [...prev, ""]);
  }, []);

  const removeApiToken = useCallback(
    (index) => {
      if (apiTokens.length > 1) {
        setApiTokens((prev) => prev.filter((_, i) => i !== index));
        if (currentTokenIndex >= index && currentTokenIndex > 0) {
          setCurrentTokenIndex((prev) => prev - 1);
        }
      }
    },
    [apiTokens.length, currentTokenIndex]
  );

  const updateApiToken = useCallback((index, value) => {
    setApiTokens((prev) =>
      prev.map((token, i) => (i === index ? value : token))
    );
  }, []);

  const addDnsRecord = useCallback(() => {
    setDnsTemplate((prev) => [
      ...prev,
      {
        type: "A",
        name: "@",
        content: "192.0.2.1",
        ttl: 1,
        enabled: true,
      },
    ]);
  }, []);

  const removeDnsRecord = useCallback((index) => {
    setDnsTemplate((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateDnsRecord = useCallback((index, field, value) => {
    setDnsTemplate((prev) =>
      prev.map((record, i) =>
        i === index ? { ...record, [field]: value } : record
      )
    );
  }, []);

  const saveTemplate = useCallback(() => {
    if (!templateName.trim()) {
      setError("Please enter a template name");
      return;
    }

    const newTemplate = {
      name: templateName,
      records: dnsTemplate,
      createdAt: new Date().toISOString(),
    };

    const updatedTemplates = [...savedTemplates, newTemplate];
    setSavedTemplates(updatedTemplates);
    localStorage.setItem("dnsTemplates", JSON.stringify(updatedTemplates));
    setTemplateName("");
  }, [templateName, dnsTemplate, savedTemplates]);

  const loadTemplate = useCallback((template) => {
    setDnsTemplate(template.records);
  }, []);

  const deleteTemplate = useCallback(
    (index) => {
      const updatedTemplates = savedTemplates.filter((_, i) => i !== index);
      setSavedTemplates(updatedTemplates);
      localStorage.setItem("dnsTemplates", JSON.stringify(updatedTemplates));
    },
    [savedTemplates]
  );

  const handleBulkDomainAdd = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProgress({});

    const domainList = domains
      .split("\n")
      .filter((domain) => domain.trim())
      .map((domain) => domain.trim().toLowerCase());

    if (domainList.length === 0) {
      setError("Please enter at least one domain");
      setLoading(false);
      return;
    }

    const validTokens = apiTokens.filter((token) => token.trim());
    if (validTokens.length === 0) {
      setError("Please enter at least one API token");
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError("Please enter your Cloudflare email");
      setLoading(false);
      return;
    }

    const enabledRecords = dnsTemplate.filter((record) => record.enabled);

    // Prepare domain configurations for bulk processing
    const domainConfigs = domainList.map((domain) => {
      const domainDnsRecords = enabledRecords.map((record) => ({
        ...record,
        name: record.name === "@" ? domain : `${record.name}.${domain}`,
      }));

      const pageRule =
        createPageRules && redirectUrl
          ? {
              targets: [
                {
                  target: "url",
                  constraint: {
                    operator: "matches",
                    value: `${domain}/*`,
                  },
                },
              ],
              actions: [
                {
                  id: "forwarding_url",
                  value: {
                    url: redirectUrl.replace("{domain}", domain),
                    status_code: 301,
                  },
                },
              ],
            }
          : null;

      return {
        domain,
        dnsRecords: domainDnsRecords,
        pageRule,
      };
    });

    try {
      // Initialize progress for all domains
      domainList.forEach((domain) => {
        setProgress((prev) => ({
          ...prev,
          [domain]: {
            status: "processing",
            message: "Starting setup...",
            step: 0,
            total: enabledRecords.length + (createPageRules ? 2 : 1),
          },
        }));
      });

      const response = await fetch("/api/cloudflare-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkDomainSetup",
          apiTokens: validTokens,
          email: email,
          domains: domainConfigs,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Update progress based on results
      if (data.results) {
        data.results.forEach((result) => {
          const { domain, success, error: domainError, steps } = result;

          if (success) {
            setProgress((prev) => ({
              ...prev,
              [domain]: {
                status: "success",
                message: "Domain setup completed successfully",
                step: steps.length,
                total: steps.length,
                details: steps,
              },
            }));
          } else {
            setProgress((prev) => ({
              ...prev,
              [domain]: {
                status: "error",
                message: domainError || "Unknown error occurred",
                step: 0,
                total: 0,
                details: steps,
              },
            }));
          }
        });
      }
    } catch (err) {
      setError(err.message);
      console.error("Bulk domain setup error:", err);

      // Mark all domains as failed
      domainList.forEach((domain) => {
        setProgress((prev) => ({
          ...prev,
          [domain]: {
            status: "error",
            message: err.message,
            step: 0,
            total: 0,
          },
        }));
      });
    } finally {
      setLoading(false);
    }
  }, [domains, dnsTemplate, email, apiTokens, createPageRules, redirectUrl]);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setDomains(e.target.result);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDnsFileUpload = useCallback((event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const lines = content
          .split("\n")
          .filter(
            (line) =>
              line.trim() &&
              !line.trim().startsWith(";") &&
              !line.trim().startsWith("$")
          );

        const newRecords = [];

        lines.forEach((line) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return;

          // Handle BIND zone format: name IN type content
          // Also handle simple format: type name content
          let parts = trimmedLine.split(/\s+/);

          // Remove empty parts
          parts = parts.filter((part) => part.trim());

          if (parts.length < 3) return; // Skip invalid lines

          let name,
            type,
            content,
            priority = null;

          // Check if it's BIND format (contains "IN")
          if (parts.includes("IN")) {
            const inIndex = parts.indexOf("IN");
            name = parts[0];
            type = parts[inIndex + 1];
            content = parts.slice(inIndex + 2).join(" ");
          } else {
            // Simple format: type name content
            type = parts[0];
            name = parts[1];
            content = parts.slice(2).join(" ");
          }

          // Clean up the content - remove quotes for TXT records
          if (type === "TXT") {
            content = content.replace(/^["']|["']$/g, "");
          }

          // Handle MX records with priority
          if (type === "MX") {
            const contentParts = content.split(/\s+/);
            if (contentParts.length >= 2 && !isNaN(contentParts[0])) {
              priority = parseInt(contentParts[0]);
              content = contentParts.slice(1).join(" ");
            }
          }

          // Clean up trailing dots from domain names
          if (type === "CNAME" || type === "MX" || type === "NS") {
            content = content.replace(/\.$/, "");
          }

          const record = {
            type: type.toUpperCase(),
            name: name,
            content: content,
            ttl: 1,
            enabled: true,
            proxied: false,
          };

          // Add priority for MX records
          if (type === "MX" && priority !== null) {
            record.priority = priority;
          }

          // Set target for CNAME records
          if (type === "CNAME") {
            record.target = content;
          }

          newRecords.push(record);
        });

        if (newRecords.length > 0) {
          setDnsTemplate(newRecords);
        } else {
          setError(
            "No valid DNS records found in the file. Please check the format."
          );
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const exportResults = useCallback(() => {
    const results = [];

    // Add header
    results.push("Domain\t\t\t\t\t\t\t\tNameserver");

    // Add each domain with its nameservers
    Object.entries(progress).forEach(([domain, result]) => {
      if (result.nameServers && result.nameServers.length > 0) {
        // Add each nameserver for the domain
        result.nameServers.forEach((nameserver) => {
          results.push(`${domain}\t\t\t\t\t\t\t\t${nameserver}`);
        });
      } else {
        // If no nameservers, show status
        results.push(
          `${domain}\t\t\t\t\t\t\t\t${
            result.status === "success" ? "Setup Complete" : result.message
          }`
        );
      }
    });

    const content = results.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domain-nameservers-${
      new Date().toISOString().split("T")[0]
    }.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [progress]);

  const themeClasses = darkMode
    ? "bg-gray-900 text-white"
    : "bg-gray-50 text-gray-900";

  const cardClasses = darkMode
    ? "bg-gray-800 border-gray-700"
    : "bg-white border-gray-200";

  const inputClasses = darkMode
    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
    : "bg-white border-gray-300 text-gray-900";

  const buttonClasses = darkMode
    ? "bg-gray-700 hover:bg-gray-600"
    : "bg-gray-200 hover:bg-gray-300";

  const successClasses = darkMode
    ? "bg-green-100 text-green-700 border border-green-200"
    : "bg-green-100 text-green-700 border border-green-200";

  const errorClasses = darkMode
    ? "bg-red-100 text-red-700 border border-red-200"
    : "bg-red-100 text-red-700 border border-red-200";

  const processingClasses = darkMode
    ? "bg-blue-100 text-blue-700 border border-blue-200"
    : "bg-blue-100 text-blue-700 border border-blue-200";

  return (
    <div
      className={`min-h-screen ${themeClasses} p-4 md:p-8 transition-colors duration-200`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-roboto">
            Wonderfets CF Domain Bulk Add!
          </h1>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg ${
              darkMode
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-gray-200 hover:bg-gray-300"
            } transition-colors`}
          >
            <i className={`fas fa-${darkMode ? "sun" : "moon"}`}></i>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className={`${cardClasses} rounded-lg shadow p-6 border`}>
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              API Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full p-2 border rounded ${inputClasses}`}
                  name="email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">
                    API Tokens
                  </label>
                  <button
                    onClick={addApiToken}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    <i className="fas fa-plus mr-1"></i>Add Token
                  </button>
                </div>

                {apiTokens.map((token, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => updateApiToken(index, e.target.value)}
                      className={`flex-1 p-2 border rounded ${inputClasses}`}
                      placeholder={`API Token ${index + 1}`}
                      name={`apiToken${index}`}
                    />
                    <span
                      className={`px-2 py-2 text-xs rounded ${
                        currentTokenIndex === index
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {currentTokenIndex === index ? "Active" : "Standby"}
                    </span>
                    {apiTokens.length > 1 && (
                      <button
                        onClick={() => removeApiToken(index)}
                        className="text-red-600 hover:text-red-800 px-2"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`${cardClasses} rounded-lg shadow p-6 border`}>
            <h2 className="text-xl font-semibold mb-4 font-roboto">
              Domain Input
            </h2>

            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className={`flex-1 p-2 border rounded ${inputClasses}`}
                />
              </div>

              <textarea
                placeholder="Enter domains (one per line)&#10;example.com&#10;example.org"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                className={`w-full h-40 p-2 border rounded ${inputClasses}`}
                name="domains"
              ></textarea>

              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createPageRules}
                    onChange={(e) => setCreatePageRules(e.target.checked)}
                    className="mr-2"
                  />
                  Create Page Rules
                </label>
              </div>

              {createPageRules && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Redirect URL Pattern
                  </label>
                  <input
                    type="url"
                    value={redirectUrl}
                    onChange={(e) => {
                      setRedirectUrl(e.target.value);
                      // Auto-enable page rules when URL is added (always enable when there's content)
                      if (e.target.value.trim()) {
                        setCreatePageRules(true);
                      }
                    }}
                    className={`w-full p-2 border rounded ${inputClasses}`}
                    placeholder="https://example.com (use {domain} for dynamic replacement)"
                    name="redirectUrl"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {"{domain}"} to dynamically replace with the actual
                    domain
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            className={`${cardClasses} rounded-lg shadow p-6 border lg:col-span-2`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold font-roboto">
                DNS Record Template
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={addDnsRecord}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                >
                  <i className="fas fa-plus mr-1"></i>Add Record
                </button>
              </div>
            </div>

            {/* DNS File Upload Section */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-6">
              <div className="text-center">
                <i className="fas fa-cloud-upload-alt text-3xl text-gray-400 mb-3"></i>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Upload DNS Records File
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Upload a .txt file with DNS records in BIND zone format or
                  simple format
                </p>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleDnsFileUpload}
                  className="hidden"
                  id="dns-file-upload"
                />
                <label
                  htmlFor="dns-file-upload"
                  className="bg-[#f6821f] hover:bg-[#da7116] text-white px-4 py-2 rounded-md cursor-pointer transition-colors"
                >
                  <i className="fas fa-upload mr-2"></i>
                  Choose DNS File
                </label>
                <div className="text-xs text-gray-500 mt-3 space-y-1">
                  <p>
                    <strong>BIND Format:</strong> @ IN A 192.0.2.1
                  </p>
                  <p>
                    <strong>Simple Format:</strong> A @ 192.0.2.1
                  </p>
                  <p>
                    <strong>CNAME Example:</strong> emailtracking IN CNAME
                    open.sleadtrack.com
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-4">
              {dnsTemplate.map((record, index) => (
                <div
                  key={index}
                  className={`p-4 border rounded-lg ${
                    darkMode
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-center">
                    {/* Enable Checkbox & Type */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={record.enabled}
                        onChange={(e) =>
                          updateDnsRecord(index, "enabled", e.target.checked)
                        }
                        className="mr-2"
                      />
                      <select
                        value={record.type}
                        onChange={(e) => {
                          updateDnsRecord(index, "type", e.target.value);
                          // Reset proxied status when changing type
                          if (
                            !["A", "AAAA", "CNAME"].includes(e.target.value)
                          ) {
                            updateDnsRecord(index, "proxied", false);
                          }
                        }}
                        className={`p-2 border rounded text-sm ${inputClasses}`}
                      >
                        <option value="A">A</option>
                        <option value="AAAA">AAAA</option>
                        <option value="CNAME">CNAME</option>
                        <option value="MX">MX</option>
                        <option value="TXT">TXT</option>
                        <option value="NS">NS</option>
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
                          updateDnsRecord(index, "name", e.target.value)
                        }
                        className={`w-full p-2 border rounded text-sm ${inputClasses}`}
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
                            ? record.target || record.content || ""
                            : record.content || ""
                        }
                        onChange={(e) => {
                          if (record.type === "CNAME") {
                            updateDnsRecord(index, "target", e.target.value);
                            updateDnsRecord(index, "content", e.target.value);
                          } else {
                            updateDnsRecord(index, "content", e.target.value);
                          }
                        }}
                        className={`w-full p-2 border rounded text-sm ${inputClasses}`}
                        placeholder={
                          record.type === "CNAME"
                            ? "target.example.com"
                            : record.type === "MX"
                            ? "mail.example.com"
                            : record.type === "TXT"
                            ? "v=spf1 include:_spf.google.com ~all"
                            : "192.0.2.1"
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
                              updateDnsRecord(index, "proxied", !record.proxied)
                            }
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#f6821f] focus:ring-offset-2 ${
                              record.proxied ? "bg-[#f6821f]" : "bg-gray-200"
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
                            index,
                            "ttl",
                            parseInt(e.target.value)
                          )
                        }
                        className={`w-full p-2 border rounded text-sm ${inputClasses}`}
                      >
                        <option value={1}>Auto</option>
                        <option value={300}>5 min</option>
                        <option value={600}>10 min</option>
                        <option value={1800}>30 min</option>
                        <option value={3600}>1 hour</option>
                        <option value={86400}>1 day</option>
                      </select>
                    </div>

                    {/* Priority (for MX records) */}
                    {record.type === "MX" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Priority
                        </label>
                        <input
                          type="number"
                          value={record.priority || 1}
                          onChange={(e) =>
                            updateDnsRecord(
                              index,
                              "priority",
                              parseInt(e.target.value)
                            )
                          }
                          className={`w-full p-2 border rounded text-sm ${inputClasses}`}
                          placeholder="10"
                          min="1"
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-end">
                      <button
                        onClick={() => removeDnsRecord(index)}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded transition-colors"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>

                  {/* Proxy Status Indicator */}
                  {record.proxied && (
                    <div className="mt-2 flex items-center text-xs text-[#f6821f]">
                      <i className="fas fa-shield-alt mr-1"></i>
                      <span>This record will be protected by Cloudflare</span>
                    </div>
                  )}
                </div>
              ))}

              {dnsTemplate.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  No DNS records configured. Upload a file or add records
                  manually.
                </div>
              )}
            </div>
          </div>

          <div
            className={`${cardClasses} rounded-lg shadow p-6 border lg:col-span-2`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold font-roboto">
                Bulk Operations
              </h2>
              {Object.keys(progress).length > 0 && (
                <button
                  onClick={exportResults}
                  className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                >
                  <i className="fas fa-download mr-1"></i>Export Results
                </button>
              )}
            </div>

            <button
              onClick={handleBulkDomainAdd}
              disabled={loading || !domains.trim() || !getCurrentApiToken()}
              className={`w-full ${buttonClasses} py-4 px-6 rounded-full text-lg font-bold transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:transform-none shadow-lg`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-3"></i>🎵 Wonder Pets
                  are working! 🎵
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  🐹🐥🐢 Start Domain Rescue Mission! 🐢🐥🐹
                </span>
              )}
            </button>

            {Object.keys(progress).length > 0 && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* Overall Progress Bar */}
                <div
                  className={`p-4 rounded-xl border-2 ${
                    darkMode
                      ? "bg-gradient-to-r from-purple-800/50 to-blue-800/50 border-purple-600"
                      : "bg-gradient-to-r from-blue-50 to-purple-50 border-blue-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg flex items-center">
                      <span className="text-2xl mr-2">📊</span>
                      Overall Mission Progress
                    </h3>
                    <div className="text-sm font-medium">
                      {(() => {
                        const totalDomains = Object.keys(progress).length;
                        const completedDomains = Object.values(progress).filter(
                          (p) => p.status === "success" || p.status === "error"
                        ).length;
                        const overallPercentage =
                          totalDomains > 0
                            ? Math.round(
                                (completedDomains / totalDomains) * 100
                              )
                            : 0;
                        return `${completedDomains}/${totalDomains} domains (${overallPercentage}%)`;
                      })()}
                    </div>
                  </div>

                  {/* Overall Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-2">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500`}
                      style={{
                        width: `${(() => {
                          const totalDomains = Object.keys(progress).length;
                          const completedDomains = Object.values(
                            progress
                          ).filter(
                            (p) =>
                              p.status === "success" || p.status === "error"
                          ).length;
                          return totalDomains > 0
                            ? (completedDomains / totalDomains) * 100
                            : 0;
                        })()}%`,
                      }}
                    ></div>
                  </div>

                  {/* Estimated Time Remaining */}
                  <div className="text-xs opacity-75">
                    {(() => {
                      const totalDomains = Object.keys(progress).length;
                      const completedDomains = Object.values(progress).filter(
                        (p) => p.status === "success" || p.status === "error"
                      ).length;
                      const processingDomains = Object.values(progress).filter(
                        (p) => p.status === "processing"
                      ).length;

                      if (
                        processingDomains === 0 &&
                        completedDomains === totalDomains
                      ) {
                        return "🎉 All domains completed!";
                      } else if (processingDomains > 0) {
                        // Estimate 30-60 seconds per domain based on DNS records and page rules
                        const avgTimePerDomain = 45; // seconds
                        const remainingDomains =
                          totalDomains - completedDomains;
                        const estimatedSeconds =
                          remainingDomains * avgTimePerDomain;
                        const minutes = Math.floor(estimatedSeconds / 60);
                        const seconds = estimatedSeconds % 60;

                        if (minutes > 0) {
                          return `⏱️ Estimated time remaining: ~${minutes}m ${seconds}s`;
                        } else {
                          return `⏱️ Estimated time remaining: ~${seconds}s`;
                        }
                      }
                      return "🚀 Ready to start mission!";
                    })()}
                  </div>
                </div>

                {/* Individual Domain Progress */}
                <h4 className="font-semibold text-md flex items-center">
                  <span className="text-xl mr-2">🎯</span>
                  Individual Domain Progress:
                </h4>
                {Object.entries(progress).map(
                  ([domain, { status, message, step, total, nameServers }]) => (
                    <div
                      key={domain}
                      className={`p-4 rounded-xl shadow-sm border-2 transition-all duration-300 ${
                        status === "success"
                          ? `${successClasses} animate-pulse`
                          : status === "error"
                          ? `${errorClasses} animate-bounce`
                          : `${processingClasses}`
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-lg flex items-center">
                          {status === "success" && "🎉 "}
                          {status === "error" && "😰 "}
                          {status === "processing" && "🔄 "}
                          {domain}
                        </span>
                        <div className="flex items-center gap-2">
                          {/* Individual Domain Percentage */}
                          {step > 0 && total > 0 && (
                            <span className="text-sm font-bold bg-white/20 px-2 py-1 rounded">
                              {Math.round((step / total) * 100)}%
                            </span>
                          )}
                          <div className="flex items-center text-xl">
                            {status === "processing" && (
                              <i className="fas fa-spinner fa-spin"></i>
                            )}
                            {status === "success" && "✅"}
                            {status === "error" && "❌"}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-medium mb-2">
                        {status === "success" && "🎵 Mission accomplished! 🎵"}
                        {status === "error" && "🚨 We need help! 🚨"}
                        {status === "processing" &&
                          "🎵 What's gonna work? TEAMWORK! 🎵"}
                      </div>
                      <div className="text-sm">{message}</div>

                      {/* Display nameservers if available */}
                      {nameServers && nameServers.length > 0 && (
                        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                          <div className="text-xs font-medium text-blue-800 mb-1">
                            🌐 Cloudflare Nameservers:
                          </div>
                          <div className="text-xs text-blue-700 space-y-1">
                            {nameServers.map((ns, index) => (
                              <div key={index} className="font-mono">
                                {index + 1}. {ns}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {step > 0 && total > 0 && (
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-3 rounded-full transition-all duration-500 ${
                                status === "success"
                                  ? "bg-gradient-to-r from-green-400 to-green-600"
                                  : status === "error"
                                  ? "bg-gradient-to-r from-red-400 to-red-600"
                                  : "bg-gradient-to-r from-blue-400 to-purple-600"
                              }`}
                              style={{ width: `${(step / total) * 100}%` }}
                            ></div>
                          </div>
                          <div className="text-xs mt-1 font-medium">
                            {step}/{total} steps completed (
                            {Math.round((step / total) * 100)}%)
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainComponent;