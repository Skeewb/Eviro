import React, { useState } from 'react';
import '../components/ProfileIcon.css';

export default function ProfileIcon({
  userId,
  displayName,
  isAdmin,
  onClick,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!userId) {
    return null;
  }

  const getInitial = () => {
    if (displayName) {
      return displayName.charAt(0).toUpperCase();
    }
    return userId.split('-')[0]?.charAt(0).toUpperCase() || 'U';
  };

  const getFullDescription = () => {
    if (displayName) {
      return `${displayName} (${userId})`;
    }
    return userId;
  };

  return (
    <div className="profile-icon-container">
      <button
        className={`profile-icon ${isAdmin ? 'admin' : ''}`}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title={getFullDescription()}
      >
        <span className="profile-icon-initial">{getInitial()}</span>
        {isAdmin && <span className="admin-badge">✓</span>}
      </button>
      {showTooltip && (
        <div className="profile-icon-tooltip">
          {displayName && (
            <>
              <div className="tooltip-name">{displayName}</div>
              <div className="tooltip-id">{userId}</div>
            </>
          )}
          {!displayName && <div className="tooltip-id">{userId}</div>}
        </div>
      )}
    </div>
  );
}
