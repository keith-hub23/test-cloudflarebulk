async function handler({ domains }) {
  if (!Array.isArray(domains) || domains.length === 0) {
    return { error: "Invalid input: domains must be a non-empty array" };
  }

  const results = {};

  for (const domain of domains) {
    if (typeof domain !== "string" || !domain.trim()) {
      continue;
    }

    const cleanDomain = domain.trim().toLowerCase();

    try {
      const dnsResponse = await fetch(
        `https://dns.google/resolve?name=${cleanDomain}&type=ANY`
      );
      const dnsData = await dnsResponse.json();

      const records = dnsData.Answer || [];

      const hasSPF = records.some(
        (record) =>
          record.type === 16 && record.data.toLowerCase().includes("v=spf1")
      );

      const hasDMARC = records.some(
        (record) =>
          record.name.toLowerCase().startsWith("_dmarc.") &&
          record.type === 16 &&
          record.data.toLowerCase().includes("v=dmarc1")
      );

      const hasMX = records.some((record) => record.type === 15);

      results[cleanDomain] = {
        spf: hasSPF,
        dmarc: hasDMARC,
        mx: hasMX,
        hasRecords: records.length > 0,
        recordCount: records.length,
      };
    } catch (error) {
      results[cleanDomain] = {
        error: "Failed to fetch DNS records",
        spf: false,
        dmarc: false,
        mx: false,
        hasRecords: false,
        recordCount: 0,
      };
    }
  }

  return results;
}
export async function POST(request) {
  return handler(await request.json());
}