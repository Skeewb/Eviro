import React, { useState, useEffect } from 'react';
import './iCloudSettings.css';

function ICloudSettings({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSynced, setIsSynced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.invoke('get-icloud-settings').then((settings) => {
        if (settings.email) {
          setEmail(settings.email);
          setIsSynced(true);
        }
      });
    }
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const result = await window.electron.ipcRenderer.invoke('connect-icloud', {
        email,
        password,
      });

      if (result.success) {
        setMessage('Connected to iCloud successfully.');
        setIsSynced(true);
        setPassword('');
      } else {
        setMessage(`Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Connection failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (window.electron && window.electron.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('disconnect-icloud');
      setEmail('');
      setPassword('');
      setIsSynced(false);
      setMessage('Disconnected from iCloud.');
    }
  };

  return (
    <div className="icloud-overlay">
      <div className="icloud-modal">
        <div className="icloud-header">
          <h2>iCloud Calendar Sync</h2>
          <button className="close-btn" onClick={onClose}>X</button>
        </div>

        {isSynced ? (
          <div className="icloud-connected">
            <div className="status-badge">Connected</div>
            <p>Email: {email}</p>
            <p className="info-text">Your iCloud Calendar events are ready to sync.</p>
            <button className="disconnect-btn" onClick={handleDisconnect}>
              Disconnect from iCloud
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="icloud-form">
            <div className="form-group">
              <label>iCloud Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@icloud.com"
                required
              />
            </div>

            <div className="form-group">
              <label>App-Specific Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Generated from iCloud settings"
                required
              />
            </div>

            {message && (
              <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}

            <button type="submit" disabled={loading} className="connect-btn">
              {loading ? 'Connecting...' : 'Connect to iCloud'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ICloudSettings;
