async function handler({ action, apiKey, email, zoneId, name, record }) {
  if (!apiKey || !email) {
    return { error: "API key and email are required" };
  }

  const baseUrl = "https://api.cloudflare.com/client/v4";
  const headers = {
    "Content-Type": "application/json",
    "X-Auth-Email": email,
    "X-Auth-Key": apiKey,
  };

  try {
    switch (action) {
      case "listZones": {
        const response = await fetch(`${baseUrl}/zones`, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.errors[0].message);
        }
        return data;
      }

      case "createZone": {
        if (!name) {
          return { error: "Zone name is required" };
        }

        const response = await fetch(`${baseUrl}/zones`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name,
            account: { id: "auto" },
            jump_start: true,
            type: "full",
          }),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.errors[0].message);
        }
        return data;
      }

      case "createDNSRecord": {
        if (!zoneId || !record) {
          return { error: "Zone ID and record details are required" };
        }

        const recordData = {
          type: record.type,
          name: record.name === "@" ? domain : record.name,
          content:
            record.type === "TXT" ? `"${record.content}"` : record.content,
          ttl: record.ttl || 1,
        };

        const response = await fetch(`${baseUrl}/zones/${zoneId}/dns_records`, {
          method: "POST",
          headers,
          body: JSON.stringify(recordData),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.errors[0].message);
        }
        return data;
      }

      case "listDNSRecords": {
        if (!zoneId) {
          return { error: "Zone ID is required" };
        }

        const response = await fetch(`${baseUrl}/zones/${zoneId}/dns_records`, {
          method: "GET",
          headers,
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.errors[0].message);
        }
        return data;
      }

      case "createPageRule": {
        if (!zoneId || !record) {
          return { error: "Zone ID and page rule details are required" };
        }

        const response = await fetch(`${baseUrl}/zones/${zoneId}/pagerules`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            targets: [
              {
                target: "url",
                constraint: { operator: "matches", value: record.url },
              },
            ],
            actions: record.actions,
            status: "active",
            priority: record.priority || 1,
          }),
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.errors[0].message);
        }
        return data;
      }

      default:
        return { error: "Invalid action specified" };
    }
  } catch (error) {
    return { error: error.message };
  }
}
export async function POST(request) {
  return handler(await request.json());
}