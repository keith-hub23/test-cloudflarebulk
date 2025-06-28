"use client";
import React from "react";

function MainComponent() {
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
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

        window.location.href = "/cloudflare-manager";
      } catch (err) {
        setError("Invalid credentials. Please check your email and API token.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [apiKey, email]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <i className="fas fa-paw text-[#f6821f] text-2xl mr-2"></i>
            <h1 className="text-xl font-bold text-gray-900 font-roboto">
              Team 4 Wonderpets
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center mb-8">
            <i className="fas fa-cloud text-[#f6821f] text-3xl mr-3"></i>
            <h2 className="text-2xl font-semibold font-roboto">
              Cloudflare Login
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#f6821f] focus:border-[#f6821f]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Token
              </label>
              <input
                type="password"
                name="apiToken"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-[#f6821f] focus:border-[#f6821f]"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#f6821f] hover:bg-[#da7116] text-white py-2 px-4 rounded-md transition-colors disabled:bg-gray-300"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Validating...
                </span>
              ) : (
                "Login"
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f6821f] hover:text-[#da7116]"
            >
              <i className="fas fa-external-link-alt mr-1"></i>
              Get your API token
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

export default MainComponent;