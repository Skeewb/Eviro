import React, { useState, useEffect } from 'react';
import './ProfileModal.css';

function ProfileModal({
  userId,
  displayName,
  nameSet,
  isAdmin,
  allProfiles,
  onClose,
  onSetName,
  onAdminChangeName,
}) {
  const [inputValue, setInputValue] = useState('');
  const [adminSearchId, setAdminSearchId] = useState('');
  const [adminNewName, setAdminNewName] = useState('');
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);

  useEffect(() => {
    if (!nameSet && !inputValue) {
      setInputValue('');
    }
  }, [nameSet, inputValue]);

  const handleSetName = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      alert('Please enter a name');
      return;
    }
    await onSetName(trimmed);
    setInputValue('');
  };

  const handleAdminChangeName = async () => {
    if (!selectedAdminUser) {
      alert('Select a user first');
      return;
    }
    const trimmed = adminNewName.trim();
    if (!trimmed) {
      alert('Please enter a name');
      return;
    }
    await onAdminChangeName(selectedAdminUser.userId, trimmed);
    setAdminNewName('');
  };

  const filteredProfiles = allProfiles.filter((p) =>
    p.userId.toLowerCase().includes(adminSearchId.toLowerCase()) ||
    (p.displayName && p.displayName.toLowerCase().includes(adminSearchId.toLowerCase()))
  );

  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-header">
          <h3>Profile Settings</h3>
          <button type="button" className="profile-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="profile-modal-content">
          <div className="profile-section">
            <div className="profile-info">
              <div className="profile-field">
                <label className="profile-label">Your ID</label>
                <div className="profile-id-display">{userId}</div>
              </div>

              <div className="profile-field">
                <label className="profile-label">Display Name</label>
                {!nameSet ? (
                  <div className="profile-name-setup">
                    <div className="profile-warning">You can only set this once</div>
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSetName();
                      }}
                      placeholder="Enter your display name"
                      className="profile-name-input"
                      maxLength="50"
                    />
                    <button type="button" className="profile-set-btn" onClick={handleSetName}>
                      Set Name
                    </button>
                  </div>
                ) : (
                  <div className="profile-name-display">{displayName || userId}</div>
                )}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="profile-section admin-section">
              <h4>Admin Panel</h4>
              <p className="admin-section-desc">Manage user profile names</p>

              <div className="admin-controls">
                <div className="admin-search">
                  <input
                    type="text"
                    value={adminSearchId}
                    onChange={(e) => {
                      setAdminSearchId(e.target.value);
                      setSelectedAdminUser(null);
                    }}
                    placeholder="Search user ID or name"
                    className="admin-search-input"
                  />
                </div>

                {adminSearchId && filteredProfiles.length > 0 && (
                  <div className="admin-users-list">
                    {filteredProfiles.slice(0, 10).map((profile) => (
                      <button
                        key={profile.userId}
                        type="button"
                        className={`admin-user-item ${selectedAdminUser?.userId === profile.userId ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedAdminUser(profile);
                          setAdminNewName('');
                        }}
                      >
                        <div className="admin-user-id">{profile.userId}</div>
                        <div className="admin-user-name">{profile.displayName || '(not set)'}</div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedAdminUser && (
                  <div className="admin-change-form">
                    <div className="admin-selected-user">
                      <strong>{selectedAdminUser.userId}</strong>
                      <span>{selectedAdminUser.displayName || '(not set)'}</span>
                    </div>
                    <input
                      type="text"
                      value={adminNewName}
                      onChange={(e) => setAdminNewName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') handleAdminChangeName();
                      }}
                      placeholder="New display name"
                      className="admin-name-input"
                      maxLength="50"
                    />
                    <button type="button" className="admin-change-btn" onClick={handleAdminChangeName}>
                      Change Name
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfileModal;
