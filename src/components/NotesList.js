import React, { useRef, useState } from 'react';
import './NotesList.css';

const makeFolderId = () => `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function NotesList({
  notes,
  folders,
  selectedFolderId,
  onSelectFolder,
  onSaveFolder,
  onDeleteFolder,
  getSubjectById,
  selectedId,
  onSelect,
  onDelete,
  onShareNote,
  onNew,
  onImportOneNote,
  onOpenSubject,
}) {
  const importInputRef = useRef(null);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const folderList = Array.isArray(folders) ? folders : [];
  const childMap = folderList.reduce((acc, folder) => {
    const key = folder.parentId || 'root';
    if (!acc[key]) acc[key] = [];
    acc[key].push(folder);
    return acc;
  }, {});

  const createFolder = (parentId = null) => {
    const base = parentId ? 'New Subfolder' : 'New Folder';
    const resolvedName = `${base} ${folderList.length + 1}`;
    const id = makeFolderId();
    onSaveFolder({ id, name: resolvedName, parentId: parentId || null });
    setEditingFolderId(id);
    setEditingFolderName(resolvedName);
  };

  const startRenameFolder = (folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name || '');
  };

  const commitRenameFolder = (folder) => {
    const nextName = String(editingFolderName || '').trim();
    onSaveFolder({ ...folder, name: nextName || folder.name || 'New Folder' });
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  const requestDeleteFolder = (folderId) => {
    const ok = window.confirm('Delete this folder and its subfolders? Notes in them will be moved to no folder.');
    if (!ok) return;
    onDeleteFolder(folderId);
  };

  const renderFolderNode = (folder, depth = 0) => (
    <div key={folder.id} className="folder-node">
      {editingFolderId === folder.id ? (
        <input
          type="text"
          className="folder-rename-input"
          style={{ marginLeft: `${8 + depth * 14}px` }}
          value={editingFolderName}
          onChange={(e) => setEditingFolderName(e.target.value)}
          onBlur={() => commitRenameFolder(folder)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRenameFolder(folder);
            if (e.key === 'Escape') {
              setEditingFolderId(null);
              setEditingFolderName('');
            }
          }}
          autoFocus
        />
      ) : (
        <button
          type="button"
          className={`folder-row ${selectedFolderId === folder.id ? 'active' : ''}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onSelectFolder(folder.id)}
        >
          {folder.name}
        </button>
      )}
      <div className="folder-row-actions">
        <button type="button" onClick={() => createFolder(folder.id)}>+</button>
        <button type="button" onClick={() => startRenameFolder(folder)}>r</button>
        <button type="button" onClick={() => requestDeleteFolder(folder.id)}>x</button>
      </div>
      {(childMap[folder.id] || []).map((child) => renderFolderNode(child, depth + 1))}
    </div>
  );

  return (
    <div className="notes-list">
      <button className="new-btn" onClick={onNew}>
        + New Note
      </button>
      <button className="new-btn import-btn" onClick={() => importInputRef.current?.click()}>
        Import PDF/File
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown,.json,.csv,.one,.onepkg,.onetoc2"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file && onImportOneNote) onImportOneNote(file);
          event.target.value = '';
        }}
      />

      <div className="folders-panel">
        <div className="folders-head">
          <strong>Folders</strong>
          <button type="button" onClick={() => createFolder(null)}>+ Folder</button>
        </div>
        <button type="button" className={`folder-row all ${selectedFolderId ? '' : 'active'}`} onClick={() => onSelectFolder(null)}>
          All Notes
        </button>
        <div className="folders-tree">
          {(childMap.root || []).map((folder) => renderFolderNode(folder))}
        </div>
      </div>

      <div className="items">
        {notes.length === 0 ? (
          <div className="list-empty">No notes yet. Create one and start writing.</div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className={`item ${selectedId === note.id ? 'active' : ''}`} style={{ borderLeft: `4px solid ${note.noteColor || '#0d6e78'}` }}>
              <div className="item-symbol">N</div>
              <div className="item-content" onClick={() => onSelect(note.id)}>
                <div className="item-title">{note.title || 'Untitled'}</div>
                <div className="item-preview">{(note.content || '').substring(0, 50)}...</div>
                <div className="item-meta">
                  {note.subjectId && getSubjectById(note.subjectId) && (
                    <button
                      type="button"
                      className="item-subject"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSubject(note.subjectId);
                      }}
                    >
                      <span className="item-subject-dot" style={{ backgroundColor: getSubjectById(note.subjectId)?.color || '#8497c5' }} />
                      {getSubjectById(note.subjectId)?.name}
                    </button>
                  )}
                  {Array.isArray(note.tags) && note.tags.length > 0 && (
                    <span className="item-tags">{note.tags.slice(0, 2).join(', ')}</span>
                  )}
                  {Array.isArray(note.images) && note.images.length > 0 && (
                    <span className="item-images">{note.images.length} image{note.images.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
              <div className="item-actions">
                <button
                  className="share-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShareNote(note.id);
                  }}
                >
                  Share
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(note.id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotesList;
