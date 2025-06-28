async function handler({
  action,
  apiTokens,
  email,
  domains,
  dnsRecords,
  pageRules,
  zoneId,
  record,
  rule,
}) {
  if (!apiTokens || !Array.isArray(apiTokens) || apiTokens.length === 0) {
    return { error: "API tokens are required and must be a non-empty array" };
  }

  if (!email) {
    return { error: "Email is required" };
  }

  let currentTokenIndex = 0;
  const maxRetries = 2; // Reduced from 3 to speed up
  const baseDelay = 500; // Reduced from 1000ms to speed up

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const shouldRotateToken = (error) => {
    if (!error) return false;
    const errorStr = error.toString().toLowerCase();
    return (
      errorStr.includes("rate limit") ||
      errorStr.includes("too many requests") ||
      errorStr.includes("timeout") ||
      errorStr.includes("5") ||
      errorStr.includes("server error")
    );
  };

  const rotateToken = () => {
    currentTokenIndex = (currentTokenIndex + 1) % apiTokens.length;
  };

  const makeCloudflareRequest = async (url, options, retryCount = 0) => {
    const currentToken = apiTokens[currentTokenIndex];

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Check if response is HTML (error page) instead of JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        throw new Error(
          `Cloudflare returned HTML error page. Status: ${response.status}`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.errors?.[0]?.message ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0].message);
      }

      return data;
    } catch (error) {
      // Handle JSON parsing errors specifically
      if (error.message.includes("Unexpected token")) {
        throw new Error(
          `Invalid response from Cloudflare API - received HTML instead of JSON. This usually means an authentication or server error.`
        );
      }

      if (shouldRotateToken(error) && apiTokens.length > 1) {
        rotateToken();
      }

      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(1.5, retryCount); // Reduced exponential backoff
        await sleep(delay);
        return makeCloudflareRequest(url, options, retryCount + 1);
      }

      throw error;
    }
  };

  // Helper function for parallel processing
  const processInBatches = async (items, batchSize, processor) => {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(processor);
      const batchResults = await Promise.allSettled(batchPromises);

      results.push(
        ...batchResults.map((result, index) => {
          if (result.status === "fulfilled") {
            return result.value;
          } else {
            return {
              success: false,
              error: result.reason.message || "Unknown error",
              item: batch[index],
            };
          }
        })
      );
    }
    return results;
  };

  try {
    switch (action) {
      case "createZone":
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
          return { error: "Domains array is required for createZone action" };
        }

        // Process domains in parallel batches of 5 for speed
        const zoneProcessor = async (domain) => {
          try {
            const data = await makeCloudflareRequest(
              "https://api.cloudflare.com/client/v4/zones",
              {
                method: "POST",
                body: JSON.stringify({
                  name: domain,
                }),
              }
            );

            return {
              domain,
              success: true,
              zoneId: data.result.id,
              nameServers: data.result.name_servers,
            };
          } catch (error) {
            if (error.message.includes("already exists")) {
              const existingZone = await makeCloudflareRequest(
                `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
                {
                  method: "GET",
                }
              );

              if (existingZone.result && existingZone.result.length > 0) {
                return {
                  domain,
                  success: true,
                  zoneId: existingZone.result[0].id,
                  nameServers: existingZone.result[0].name_servers,
                  existed: true,
                };
              }
            }

            return {
              domain,
              success: false,
              error: error.message,
            };
          }
        };

        const zoneResults = await processInBatches(domains, 5, zoneProcessor);
        return { results: zoneResults };

      case "createDNSRecords":
        if (!zoneId || !dnsRecords || !Array.isArray(dnsRecords)) {
          return { error: "Zone ID and DNS records array are required" };
        }

        // Process DNS records in parallel batches of 3
        const dnsProcessor = async (record) => {
          try {
            const recordData = {
              type: record.type,
              name: record.name === "@" ? domain : record.name,
              content:
                record.type === "TXT" ? `"${record.content}"` : record.content,
              ttl: record.ttl || 1,
            };

            // Add proxy status for proxiable records
            if (
              record.type === "A" ||
              record.type === "AAAA" ||
              record.type === "CNAME"
            ) {
              recordData.proxied = record.proxied || false;
            }

            if (
              record.priority &&
              (record.type === "MX" || record.type === "SRV")
            ) {
              recordData.priority = record.priority;
            }

            const data = await makeCloudflareRequest(
              `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
              {
                method: "POST",
                body: JSON.stringify(recordData),
              }
            );

            return {
              record: recordData,
              success: true,
              recordId: data.result.id,
            };
          } catch (error) {
            return {
              record,
              success: false,
              error: error.message,
            };
          }
        };

        const dnsResults = await processInBatches(dnsRecords, 3, dnsProcessor);
        return { results: dnsResults };

      case "createPageRule":
        if (!zoneId || !rule) {
          return { error: "Zone ID and page rule configuration are required" };
        }

        try {
          const data = await makeCloudflareRequest(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/pagerules`,
            {
              method: "POST",
              body: JSON.stringify(rule),
            }
          );

          return {
            success: true,
            ruleId: data.result.id,
            rule: data.result,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }

      case "bulkDomainSetup":
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
          return { error: "Domains array is required for bulk setup" };
        }

        // Process bulk domains in parallel batches of 3 for optimal speed vs rate limits
        const bulkProcessor = async (domainConfig) => {
          const {
            domain,
            dnsRecords: domainDnsRecords,
            pageRule,
          } = domainConfig;
          const domainResult = {
            domain,
            steps: [],
            nameServers: null, // Add nameservers field
          };

          try {
            let currentZoneId;

            domainResult.steps.push({
              step: "createZone",
              status: "processing",
            });

            try {
              const zoneData = await makeCloudflareRequest(
                "https://api.cloudflare.com/client/v4/zones",
                {
                  method: "POST",
                  body: JSON.stringify({
                    name: domain,
                  }),
                }
              );

              currentZoneId = zoneData.result.id;
              domainResult.nameServers = zoneData.result.name_servers; // Capture nameservers
              domainResult.steps[0] = {
                step: "createZone",
                status: "success",
                zoneId: currentZoneId,
                nameServers: zoneData.result.name_servers,
              };
            } catch (error) {
              if (error.message.includes("already exists")) {
                const existingZone = await makeCloudflareRequest(
                  `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
                  {
                    method: "GET",
                  }
                );

                if (existingZone.result && existingZone.result.length > 0) {
                  currentZoneId = existingZone.result[0].id;
                  domainResult.nameServers =
                    existingZone.result[0].name_servers; // Capture nameservers for existing zones
                  domainResult.steps[0] = {
                    step: "createZone",
                    status: "success",
                    zoneId: currentZoneId,
                    nameServers: existingZone.result[0].name_servers,
                    existed: true,
                  };
                } else {
                  throw error;
                }
              } else {
                throw error;
              }
            }

            if (domainDnsRecords && domainDnsRecords.length > 0) {
              domainResult.steps.push({
                step: "createDNSRecords",
                status: "processing",
              });

              // Process DNS records in parallel for this domain
              const dnsRecordProcessor = async (record) => {
                try {
                  const recordData = {
                    type: record.type,
                    name: record.name === "@" ? domain : record.name,
                    content:
                      record.type === "TXT"
                        ? `"${record.content}"`
                        : record.content,
                    ttl: record.ttl || 1,
                  };

                  // Add proxy status for proxiable records
                  if (
                    record.type === "A" ||
                    record.type === "AAAA" ||
                    record.type === "CNAME"
                  ) {
                    recordData.proxied = record.proxied || false;
                  }

                  if (
                    record.priority &&
                    (record.type === "MX" || record.type === "SRV")
                  ) {
                    recordData.priority = record.priority;
                  }

                  const data = await makeCloudflareRequest(
                    `https://api.cloudflare.com/client/v4/zones/${currentZoneId}/dns_records`,
                    {
                      method: "POST",
                      body: JSON.stringify(recordData),
                    }
                  );

                  return {
                    record: recordData,
                    success: true,
                    recordId: data.result.id,
                  };
                } catch (error) {
                  return {
                    record,
                    success: false,
                    error: error.message,
                  };
                }
              };

              const dnsRecordResults = await processInBatches(
                domainDnsRecords,
                2,
                dnsRecordProcessor
              );

              domainResult.steps[1] = {
                step: "createDNSRecords",
                status: "success",
                results: dnsRecordResults,
              };
            }

            if (pageRule) {
              domainResult.steps.push({
                step: "createPageRule",
                status: "processing",
              });

              try {
                const data = await makeCloudflareRequest(
                  `https://api.cloudflare.com/client/v4/zones/${currentZoneId}/pagerules`,
                  {
                    method: "POST",
                    body: JSON.stringify(pageRule),
                  }
                );

                domainResult.steps[domainResult.steps.length - 1] = {
                  step: "createPageRule",
                  status: "success",
                  ruleId: data.result.id,
                };
              } catch (error) {
                domainResult.steps[domainResult.steps.length - 1] = {
                  step: "createPageRule",
                  status: "error",
                  error: error.message,
                };
              }
            }

            domainResult.success = true;
            return domainResult;
          } catch (error) {
            domainResult.success = false;
            domainResult.error = error.message;

            const lastStepIndex = domainResult.steps.length - 1;
            if (lastStepIndex >= 0) {
              domainResult.steps[lastStepIndex] = {
                ...domainResult.steps[lastStepIndex],
                status: "error",
                error: error.message,
              };
            }
            return domainResult;
          }
        };

        const bulkResults = await processInBatches(domains, 3, bulkProcessor);
        return { results: bulkResults };

      case "listZones":
        try {
          const data = await makeCloudflareRequest(
            "https://api.cloudflare.com/client/v4/zones",
            {
              method: "GET",
            }
          );

          return {
            success: true,
            zones: data.result,
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
          };
        }

      default:
        return { error: `Unknown action: ${action}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      currentTokenIndex,
    };
  }
}
export async function POST(request) {
  return handler(await request.json());
}