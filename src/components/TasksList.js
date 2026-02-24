import React, { useState } from 'react';
import './TasksList.css';

const makeFolderId = () => `folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function TasksList({
  tasks,
  folders,
  selectedFolderId,
  onSelectFolder,
  onSaveFolder,
  onDeleteFolder,
  getSubjectById,
  selectedId,
  onSelect,
  onDelete,
  onNew,
  onToggle,
  onOpenSubject,
}) {
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
    const ok = window.confirm('Delete this folder and its subfolders? Tasks in them will be moved to no folder.');
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

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="tasks-list">
      <button className="new-btn" onClick={onNew}>
        + New Task
      </button>

      <div className="task-stats">
        {completedCount} / {tasks.length} completed
      </div>

      <div className="folders-panel">
        <div className="folders-head">
          <strong>Folders</strong>
          <button type="button" onClick={() => createFolder(null)}>+ Folder</button>
        </div>
        <button type="button" className={`folder-row all ${selectedFolderId ? '' : 'active'}`} onClick={() => onSelectFolder(null)}>
          All Tasks
        </button>
        <div className="folders-tree">
          {(childMap.root || []).map((folder) => renderFolderNode(folder))}
        </div>
      </div>

      <div className="items">
        {tasks.length === 0 ? (
          <div className="list-empty">No tasks yet. Create one and plan your next step.</div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`item ${selectedId === task.id ? 'active' : ''}`}
            >
              <div className="item-symbol">T</div>
              <input
                type="checkbox"
                checked={task.completed}
                 onChange={(e) => {
                  e.stopPropagation();
                  onToggle(task.id);
                }}
                className="task-checkbox"
              />
              <div className="item-content" onClick={() => onSelect(task.id)}>
                <div className={`item-title ${task.completed ? 'completed' : ''}`}>
                  {task.title}
                </div>
                {task.subjectId && getSubjectById(task.subjectId) && (
                  <button
                    type="button"
                    className="item-subject"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenSubject(task.subjectId);
                    }}
                  >
                    <span className="item-subject-dot" style={{ backgroundColor: getSubjectById(task.subjectId)?.color || '#8497c5' }} />
                    {getSubjectById(task.subjectId)?.name}
                  </button>
                )}
                {task.dueDate && <div className="item-due">Due: {task.dueDate}</div>}
              </div>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.id);
                }}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TasksList;
