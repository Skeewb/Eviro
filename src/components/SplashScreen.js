import React, { useState } from 'react';
import './SplashScreen.css';

function SplashScreen() {
  const [logoVisible, setLogoVisible] = useState(true);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo">
          {logoVisible ? (
            <img
              src={`${process.env.PUBLIC_URL}/app-logo.png`}
              alt="App logo"
              className="splash-logo-image"
              onError={() => setLogoVisible(false)}
            />
          ) : (
            <div className="logo-fallback">NT</div>
          )}
        </div>
        <h1 className="splash-title">Workspace</h1>
        <p className="splash-subtitle">By:Ben Weeks</p>

        <div className="loading-container">
          <div className="loading-dots">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        </div>

        <p className="splash-loading-text">Loading your data...</p>
      </div>
    </div>
  );
}

export default SplashScreen;
