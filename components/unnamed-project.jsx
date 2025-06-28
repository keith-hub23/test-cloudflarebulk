"use client";
import React from "react";



export default function Index() {
  return (function MainComponent({ title, apiKey, email, loading, onApiKeyChange, onEmailChange, onSubmit }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4 font-roboto">{title}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            API Key
          </label>
          <input
            type="password"
            name="apiKey"
            value={apiKey}
            onChange={onApiKeyChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={email}
            onChange={onEmailChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#f6821f] hover:bg-[#da7116] text-white py-2 px-4 rounded-md transition-colors"
        >
          {loading ? "Authenticating..." : "Authenticate"}
        </button>
      </form>
    </div>
  );
}

function StoryComponent() {
  const [apiKey, setApiKey] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleApiKeyChange = (e) => setApiKey(e.target.value);
  const handleEmailChange = (e) => setEmail(e.target.value);
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div>
      <MainComponent
        title="Authentication"
        apiKey={apiKey}
        email={email}
        loading={loading}
        onApiKeyChange={handleApiKeyChange}
        onEmailChange={handleEmailChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
});
}