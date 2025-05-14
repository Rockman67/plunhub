import { useState, useEffect } from 'react';

function App() {
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [hasCookies, setHasCookies] = useState(false);
  const [activeTab, setActiveTab] = useState('main');

  useEffect(() => {
    if (window.api) {
      window.api.onScrapeLog((msg) => {
        setLogs(prev => [...new Set([...prev, msg])]);
      });

      window.api.onScrapeResults((data) => {
        setResults(data);
        setIsRunning(false);
      });

      window.api.onCookiesStatus((status) => {
        setHasCookies(status);
      });

      window.api.checkCookies();
    }
  }, []);

  const startScraping = () => {
    setLogs([]);
    setResults([]);
    setIsRunning(true);
    window.api.startScraping();
    setActiveTab('main'); // автоматически переключаем на главную вкладку
  };

  const downloadCSV = () => {
    const header = ['Project', 'Company', 'Email', 'Phone', 'Bid Date'];
    const rows = results.map(r => [r.project, r.company, r.email, r.phone, r.bidDate]);
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "scraping_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uploadCookies = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const cookies = JSON.parse(e.target.result);
        window.api.uploadCookies(cookies);
        setHasCookies(true);
      } catch (err) {
        alert('Ошибка загрузки куков: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-10 bg-gray-100 h-screen flex flex-col">
      <h1 className="text-3xl font-bold text-center mb-4">PlanHub Scraper</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setActiveTab('main')}
          className={`px-4 py-2 rounded ${activeTab === 'main' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Main
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 rounded ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Logs
        </button>
      </div>

      {activeTab === 'main' && (
        <div>
          {!hasCookies && (
            <input type="file" accept=".json" onChange={uploadCookies} className="mb-4"/>
          )}

          <button
            onClick={startScraping}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mb-4 disabled:bg-gray-400"
            disabled={isRunning || !hasCookies}
          >
            {isRunning
              ? 'Running...'
              : hasCookies ? 'Start Scraping' : 'Upload cookies first!'}
          </button>

          {isRunning && <div className="mt-4">Scraping in progress, check logs for details...</div>}
          {results.length > 0 && (
            <div className="mt-4 bg-white p-4 shadow rounded">
              <h2 className="text-xl font-semibold mb-2">Results:</h2>
              <table className="table-auto w-full">
                <thead>
				  <tr>
					<th className="border px-4 py-2">Project</th>
					<th className="border px-4 py-2">Company</th>
					<th className="border px-4 py-2">Person</th>
					<th className="border px-4 py-2">Email</th>
					<th className="border px-4 py-2">Phone</th>
					<th className="border px-4 py-2">Bid Date</th>
					<th className="border px-4 py-2">No Bid Date</th>
					<th className="border px-4 py-2">City</th>
					<th className="border px-4 py-2">State</th>
					<th className="border px-4 py-2">Trade Category</th>
					<th className="border px-4 py-2">CSI Code</th>
				  </tr>
				</thead>

                <tbody>
				  {results.map((r, idx) => (
					<tr key={idx}>
					  <td className="border px-4 py-2">{r.project}</td>
					  <td className="border px-4 py-2">{r.company}</td>
					  <td className="border px-4 py-2">{r.person}</td>
					  <td className="border px-4 py-2">{r.email}</td>
					  <td className="border px-4 py-2">{r.phone}</td>
					  <td className="border px-4 py-2">{r.bidDate}</td>
					  <td className="border px-4 py-2">{r.noBidDate ? 'Yes' : 'No'}</td>
					  <td className="border px-4 py-2">{r.city}</td>
					  <td className="border px-4 py-2">{r.state}</td>
					  <td className="border px-4 py-2">{r.tradeCategory}</td>
					  <td className="border px-4 py-2">{r.csiCode}</td>
					</tr>
				  ))}
				</tbody>

              </table>
              <button
                onClick={downloadCSV}
                className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              >
                Download CSV
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white p-4 shadow rounded overflow-auto flex-1">
          <h2 className="text-xl font-semibold mb-2">Detailed Logs:</h2>
          <ul className="text-sm font-mono">
            {logs.map((log, idx) => (
              <li key={idx}>{log}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
