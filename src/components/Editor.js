import React, { useEffect, useMemo, useRef, useState } from 'react';
import './Editor.css';

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const MIN_CANVAS_WIDTH = 1200;
const MIN_CANVAS_HEIGHT = 900;
const CANVAS_PADDING = 120;
const CANVAS_EXTRA_MARGIN = 220;
const MIN_CANVAS_ZOOM = 0.5;
const MAX_CANVAS_ZOOM = 2;

const normalizeNoteBlocks = (note) => {
  const existing = Array.isArray(note.noteBlocks) ? note.noteBlocks : null;
  if (existing && existing.length) {
    return existing.map((block, idx) => ({
      id: block.id || `blk-${idx}-${Date.now()}`,
      type: block.type === 'image' ? 'image' : 'text',
      x: Number.isFinite(block.x) ? block.x : 24 + idx * 20,
      y: Number.isFinite(block.y) ? block.y : 24 + idx * 16,
      width: Number.isFinite(block.width) ? block.width : block.type === 'image' ? 260 : 320,
      height: Number.isFinite(block.height) ? block.height : block.type === 'image' ? 180 : 180,
      text: typeof block.text === 'string' ? block.text : '',
      textColor: block.textColor || '#1f2f4a',
      fontSize: Number.isFinite(block.fontSize) ? block.fontSize : 16,
      src: typeof block.src === 'string' ? block.src : '',
    }));
  }

  const blocks = [];
  const legacyContent = typeof note.content === 'string' ? note.content : '';
  if (legacyContent.trim()) {
    blocks.push({
      id: `txt-${Date.now()}`,
      type: 'text',
      x: 24,
      y: 24,
      width: 360,
      height: 200,
      text: legacyContent,
      textColor: '#1f2f4a',
      fontSize: 16,
      src: '',
    });
  } else {
    blocks.push({
      id: `txt-${Date.now()}`,
      type: 'text',
      x: 24,
      y: 24,
      width: 360,
      height: 160,
      text: '',
      textColor: '#1f2f4a',
      fontSize: 16,
      src: '',
    });
  }

  const legacyImages = Array.isArray(note.images) ? note.images : [];
  legacyImages.forEach((img, idx) => {
    const src = typeof img === 'string' ? img : img?.src || '';
    if (!src) return;
    blocks.push({
      id: `img-${idx}-${Date.now()}`,
      type: 'image',
      x: Number.isFinite(img?.x) ? img.x : 440 + (idx % 2) * 24,
      y: Number.isFinite(img?.y) ? img.y : 24 + idx * 36,
      width: Number.isFinite(img?.width) ? img.width : 260,
      height: Number.isFinite(img?.height) ? img.height : 180,
      text: '',
      textColor: '#1f2f4a',
      fontSize: 16,
      src,
    });
  });

  return blocks;
};

function Editor({ item, type, subjects, folders, getSubjectById, onOpenSubject, onSave, onDelete }) {
  const getInitialCanvasSize = (note, blocks) => {
    const savedWidth = Number.isFinite(note?.noteCanvasSize?.width) ? note.noteCanvasSize.width : MIN_CANVAS_WIDTH;
    const savedHeight = Number.isFinite(note?.noteCanvasSize?.height) ? note.noteCanvasSize.height : MIN_CANVAS_HEIGHT;
    const usedWidth = blocks.reduce((max, block) => Math.max(max, (block.x || 0) + (block.width || 0)), 0) + CANVAS_PADDING;
    const usedHeight = blocks.reduce((max, block) => Math.max(max, (block.y || 0) + (block.height || 0)), 0) + CANVAS_PADDING;
    const cappedSavedWidth = Math.min(savedWidth, usedWidth + CANVAS_EXTRA_MARGIN);
    const cappedSavedHeight = Math.min(savedHeight, usedHeight + CANVAS_EXTRA_MARGIN);
    return {
      width: Math.max(cappedSavedWidth, usedWidth, MIN_CANVAS_WIDTH),
      height: Math.max(cappedSavedHeight, usedHeight, MIN_CANVAS_HEIGHT),
    };
  };

  const initialBlocks = normalizeNoteBlocks(item);
  const [title, setTitle] = useState(item.title || '');
  const [content, setContent] = useState(item.content || '');
  const [noteColor, setNoteColor] = useState(item.noteColor || '#e8f3f7');
  const [tagsText, setTagsText] = useState((item.tags || []).join(', '));
  const [noteBlocks, setNoteBlocks] = useState(initialBlocks);
  const [noteCanvasSize, setNoteCanvasSize] = useState(getInitialCanvasSize(item, initialBlocks));
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [description, setDescription] = useState(item.description || '');
  const [completed, setCompleted] = useState(item.completed || false);
  const [dueDate, setDueDate] = useState(item.dueDate || '');
  const [folderId, setFolderId] = useState(item.folderId || '');
  const [subjectId, setSubjectId] = useState(item.subjectId || '');
  const [recurrence, setRecurrence] = useState(item.recurrence || 'none');
  const [recurrenceEnd, setRecurrenceEnd] = useState(item.recurrenceEnd || '');
  const [dueTime, setDueTime] = useState(item.dueTime || '');
  const [isAllDay, setIsAllDay] = useState(item.isAllDay || false);
  const [saved, setSaved] = useState(true);
  const [dragState, setDragState] = useState(null);
  const [resizeState, setResizeState] = useState(null);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [isHeadBarCollapsed, setIsHeadBarCollapsed] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    setTitle(item.title || '');
    setContent(item.content || '');
    setNoteColor(item.noteColor || '#e8f3f7');
    setTagsText((item.tags || []).join(', '));
    const nextBlocks = normalizeNoteBlocks(item);
    setNoteBlocks(nextBlocks);
    setNoteCanvasSize(getInitialCanvasSize(item, nextBlocks));
    setSelectedBlockId(null);
    setDescription(item.description || '');
    setCompleted(item.completed || false);
    setDueDate(item.dueDate || '');
    setDueTime(item.dueTime || '');
    setIsAllDay(item.isAllDay || false);
    setFolderId(item.folderId || '');
    setSubjectId(item.subjectId || '');
    setRecurrence(item.recurrence || 'none');
    setRecurrenceEnd(item.recurrenceEnd || '');
    setSaved(true);
    setCanvasZoom(1);
    setIsHeadBarCollapsed(false);
  }, [item]);

  const selectedBlock = useMemo(
    () => noteBlocks.find((block) => block.id === selectedBlockId) || null,
    [noteBlocks, selectedBlockId]
  );

  const fitCanvasToBlocks = () => {
    const usedWidth = noteBlocks.reduce((max, block) => Math.max(max, block.x + block.width), 0) + CANVAS_PADDING;
    const usedHeight = noteBlocks.reduce((max, block) => Math.max(max, block.y + block.height), 0) + CANVAS_PADDING;
    setNoteCanvasSize({
      width: Math.max(usedWidth, MIN_CANVAS_WIDTH),
      height: Math.max(usedHeight, MIN_CANVAS_HEIGHT),
    });
    markChanged();
  };

  const markChanged = () => setSaved(false);

  const syncLegacyNoteContent = (blocks) => {
    const nextContent = blocks
      .filter((block) => block.type === 'text' && block.text.trim())
      .map((block) => block.text.trim())
      .join('\n\n');
    setContent(nextContent);
  };

  const updateNoteBlocks = (updater) => {
    setNoteBlocks((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      syncLegacyNoteContent(next);
      const requiredWidth = next.reduce((max, block) => Math.max(max, block.x + block.width), 0) + CANVAS_PADDING;
      const requiredHeight = next.reduce((max, block) => Math.max(max, block.y + block.height), 0) + CANVAS_PADDING;
      setNoteCanvasSize((canvasPrev) => ({
        width: Math.max(canvasPrev.width, requiredWidth, MIN_CANVAS_WIDTH),
        height: Math.max(canvasPrev.height, requiredHeight, MIN_CANVAS_HEIGHT),
      }));
      return next;
    });
    markChanged();
  };

  const handleSave = () => {
    const usedWidth = noteBlocks.reduce((max, block) => Math.max(max, block.x + block.width), 0) + CANVAS_PADDING;
    const usedHeight = noteBlocks.reduce((max, block) => Math.max(max, block.y + block.height), 0) + CANVAS_PADDING;
    const fittedCanvasSize = {
      width: Math.max(usedWidth, MIN_CANVAS_WIDTH),
      height: Math.max(usedHeight, MIN_CANVAS_HEIGHT),
    };
    if (type === 'notes') {
      setNoteCanvasSize(fittedCanvasSize);
    }

    const updated = {
      ...item,
      ...(type === 'notes'
        ? {
            title,
            content,
            noteColor,
            folderId: folderId || null,
            subjectId: subjectId || null,
            tags: tagsText
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            images: noteBlocks.filter((block) => block.type === 'image').map((block) => block.src),
            noteBlocks,
            noteCanvasSize: fittedCanvasSize,
          }
        : { title, description, completed, dueDate, dueTime, isAllDay, folderId: folderId || null, subjectId: subjectId || null, recurrence, recurrenceEnd }),
    };
    onSave(updated);
    setSaved(true);
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const addTextBlock = () => {
    const newBlock = {
      id: `txt-${makeId()}`,
      type: 'text',
      x: 28 + (noteBlocks.length % 5) * 22,
      y: 28 + (noteBlocks.length % 4) * 18,
      width: 320,
      height: 180,
      text: '',
      textColor: '#1f2f4a',
      fontSize: 16,
      src: '',
    };
    updateNoteBlocks((prev) => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
  };

  const readAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Image read failed'));
      reader.readAsDataURL(file);
    });

  const getImageSize = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth || 280, height: img.naturalHeight || 190 });
      img.onerror = () => resolve({ width: 280, height: 190 });
      img.src = src;
    });

  const addImageBlocksFromFiles = async (files, preserveOriginalSize = false) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    try {
      const loaded = await Promise.all(list.map((file) => readAsDataUrl(file)));
      const sizes = await Promise.all(loaded.map((src) => getImageSize(src)));
      const newBlocks = loaded.map((src, idx) => ({
        id: `img-${makeId()}`,
        type: 'image',
        x: 36 + ((noteBlocks.length + idx) % 5) * 26,
        y: 36 + ((noteBlocks.length + idx) % 4) * 22,
        width: preserveOriginalSize ? sizes[idx].width : 280,
        height: preserveOriginalSize ? sizes[idx].height : 190,
        text: '',
        textColor: '#1f2f4a',
        fontSize: 16,
        src,
      }));
      updateNoteBlocks((prev) => [...prev, ...newBlocks]);
      setSelectedBlockId(newBlocks[newBlocks.length - 1].id);
    } catch {
      // ignore failed files
    }
  };

  const handleAddImages = async (e) => {
    await addImageBlocksFromFiles(e.target.files, false);
    e.target.value = '';
  };

  const handlePasteImages = async (e) => {
    const imageFiles = Array.from(e.clipboardData?.items || [])
      .filter((entry) => entry.type && entry.type.startsWith('image/'))
      .map((entry) => entry.getAsFile())
      .filter(Boolean);
    if (!imageFiles.length) return;
    e.preventDefault();
    await addImageBlocksFromFiles(imageFiles, true);
  };

  const removeBlock = (id) => {
    updateNoteBlocks((prev) => prev.filter((block) => block.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateBlockById = (id, patch) => {
    updateNoteBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  const zoomPercent = Math.round(canvasZoom * 100);
  const setZoom = (nextZoom) => setCanvasZoom(clamp(nextZoom, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM));

  const getCanvasPointer = (e, rect) => ({
    x: (e.clientX - rect.left) / canvasZoom,
    y: (e.clientY - rect.top) / canvasZoom,
  });

  const startDraggingBlock = (e, block) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const pointer = getCanvasPointer(e, rect);
    setDragState({
      id: block.id,
      offsetX: pointer.x - block.x,
      offsetY: pointer.y - block.y,
    });
    setSelectedBlockId(block.id);
  };

  const moveDraggedBlock = (e) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    if (resizeState) {
      const block = noteBlocks.find((entry) => entry.id === resizeState.id);
      if (!block) return;
      const dx = Math.round((e.clientX - resizeState.startMouseX) / canvasZoom);
      const dy = Math.round((e.clientY - resizeState.startMouseY) / canvasZoom);
      let nextX = resizeState.startX;
      let nextY = resizeState.startY;
      let nextWidth = resizeState.startWidth;
      let nextHeight = resizeState.startHeight;

      if (resizeState.corner.includes('e')) nextWidth = resizeState.startWidth + dx;
      if (resizeState.corner.includes('s')) nextHeight = resizeState.startHeight + dy;
      if (resizeState.corner.includes('w')) {
        nextWidth = resizeState.startWidth - dx;
        nextX = resizeState.startX + dx;
      }
      if (resizeState.corner.includes('n')) {
        nextHeight = resizeState.startHeight - dy;
        nextY = resizeState.startY + dy;
      }

      const minWidth = 120;
      const minHeight = 90;
      nextWidth = Math.max(minWidth, nextWidth);
      nextHeight = Math.max(minHeight, nextHeight);
      if (nextX + nextWidth > noteCanvasSize.width - 24) {
        setNoteCanvasSize((prev) => ({ ...prev, width: prev.width + 400 }));
      }
      if (nextY + nextHeight > noteCanvasSize.height - 24) {
        setNoteCanvasSize((prev) => ({ ...prev, height: prev.height + 300 }));
      }
      nextX = clamp(nextX, 0, Math.max(0, noteCanvasSize.width - nextWidth));
      nextY = clamp(nextY, 0, Math.max(0, noteCanvasSize.height - nextHeight));
      nextWidth = Math.min(nextWidth, noteCanvasSize.width - nextX);
      nextHeight = Math.min(nextHeight, noteCanvasSize.height - nextY);

      updateNoteBlocks((prev) =>
        prev.map((entry) =>
          entry.id === resizeState.id
            ? { ...entry, x: nextX, y: nextY, width: Math.round(nextWidth), height: Math.round(nextHeight) }
            : entry
        )
      );
      return;
    }

    if (!dragState) return;
    const block = noteBlocks.find((entry) => entry.id === dragState.id);
    if (!block) return;
    const pointer = getCanvasPointer(e, rect);
    const maxX = Math.max(0, noteCanvasSize.width - block.width);
    const maxY = Math.max(0, noteCanvasSize.height - block.height);
    const rawX = Math.round(pointer.x - dragState.offsetX);
    const rawY = Math.round(pointer.y - dragState.offsetY);
    if (rawX > maxX - 24) {
      setNoteCanvasSize((prev) => ({ ...prev, width: prev.width + 400 }));
    }
    if (rawY > maxY - 24) {
      setNoteCanvasSize((prev) => ({ ...prev, height: prev.height + 300 }));
    }
    const nextX = clamp(rawX, 0, maxX);
    const nextY = clamp(rawY, 0, maxY);
    updateNoteBlocks((prev) => prev.map((entry) => (entry.id === dragState.id ? { ...entry, x: nextX, y: nextY } : entry)));
  };

  const startResizingBlock = (e, block, corner) => {
    e.stopPropagation();
    e.preventDefault();
    setResizeState({
      id: block.id,
      corner,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startX: block.x,
      startY: block.y,
      startWidth: block.width,
      startHeight: block.height,
    });
    setSelectedBlockId(block.id);
  };

  const stopDraggingBlock = () => {
    setDragState(null);
    setResizeState(null);
  };

  return (
    <div className="editor">
      <div className="editor-header">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markChanged();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Title"
          className="editor-title"
        />
        <div className="editor-actions">
          <span className={`save-status ${saved ? 'saved' : 'unsaved'}`}>{saved ? 'Saved' : 'Unsaved'}</span>
          <button className="save-btn" onClick={handleSave}>
            Save
          </button>
          <button className="delete-btn" onClick={() => onDelete(item.id)}>
            Delete
          </button>
        </div>
      </div>

      {type === 'notes' ? (
        <div className="note-editor" onKeyDown={handleKeyDown}>
          <div className={`note-headbar ${isHeadBarCollapsed ? 'collapsed' : ''}`}>
            <div className="note-headbar-top">
              <button
                type="button"
                className="headbar-toggle-btn"
                onClick={() => setIsHeadBarCollapsed((prev) => !prev)}
                aria-expanded={!isHeadBarCollapsed}
              >
                {isHeadBarCollapsed ? 'Show Controls' : 'Hide Controls'}
                <span className={`headbar-toggle-icon ${isHeadBarCollapsed ? 'collapsed' : ''}`}>^</span>
              </button>
            </div>

            {!isHeadBarCollapsed && (
              <>
                <div className="note-customize">
                  <div className="form-group">
                    <label>Canvas Color</label>
                    <input
                      type="color"
                      value={noteColor}
                      onChange={(e) => {
                        setNoteColor(e.target.value);
                        markChanged();
                      }}
                      className="note-color-picker"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tags (comma separated)</label>
                    <input
                      type="text"
                      value={tagsText}
                      onChange={(e) => {
                        setTagsText(e.target.value);
                        markChanged();
                      }}
                      placeholder="study, homework, ideas"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Subject</label>
                    <select
                      value={subjectId}
                      onChange={(e) => {
                        setSubjectId(e.target.value);
                        markChanged();
                      }}
                      className="form-input"
                    >
                      <option value="">No subject</option>
                      {(subjects || []).map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    {subjectId && getSubjectById(subjectId) && (
                      <button
                        type="button"
                        className="subject-link-inline"
                        onClick={() => onOpenSubject(subjectId)}
                      >
                        Open {getSubjectById(subjectId)?.name}
                      </button>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Folder</label>
                    <select
                      value={folderId}
                      onChange={(e) => {
                        setFolderId(e.target.value);
                        markChanged();
                      }}
                      className="form-input"
                    >
                      <option value="">No folder</option>
                      {(folders || []).map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Add Pictures</label>
                    <label className="file-input-label">
                      <input type="file" accept="image/*" multiple onChange={handleAddImages} className="file-input" />
                      <span className="file-input-text">Choose Files</span>
                    </label>
                  </div>

                  <div className="note-tools">
                    <button type="button" className="tool-btn" onClick={addTextBlock}>
                      + Text Box
                    </button>
                    <button type="button" className="tool-btn" onClick={fitCanvasToBlocks}>
                      Fit Canvas
                    </button>
                    <div className="zoom-controls">
                      <button type="button" className="tool-btn zoom-btn" onClick={() => setZoom(canvasZoom - 0.1)}>
                        -
                      </button>
                      <button type="button" className="tool-btn zoom-readout" onClick={() => setZoom(1)}>
                        {zoomPercent}%
                      </button>
                      <button type="button" className="tool-btn zoom-btn" onClick={() => setZoom(canvasZoom + 0.1)}>
                        +
                      </button>
                    </div>
                    <span>Tip: paste screenshots directly (Ctrl/Cmd + V)</span>
                  </div>
                </div>

                {selectedBlock && (
                  <div className="block-customize">
                    <strong>Selected {selectedBlock.type === 'text' ? 'Text Box' : 'Image'}</strong>
                    <label>
                      Width
                      <input
                        type="number"
                        min="120"
                        max="5000"
                        value={selectedBlock.width}
                        onChange={(e) =>
                          updateBlockById(selectedBlock.id, { width: clamp(Number(e.target.value) || 120, 120, 5000) })
                        }
                      />
                    </label>
                    <label>
                      Height
                      <input
                        type="number"
                        min="90"
                        max="5000"
                        value={selectedBlock.height}
                        onChange={(e) =>
                          updateBlockById(selectedBlock.id, { height: clamp(Number(e.target.value) || 90, 90, 5000) })
                        }
                      />
                    </label>
                    {selectedBlock.type === 'text' && (
                      <>
                        <label>
                          Text Size
                          <input
                            type="number"
                            min="10"
                            max="72"
                            value={selectedBlock.fontSize}
                            onChange={(e) =>
                              updateBlockById(selectedBlock.id, {
                                fontSize: clamp(Number(e.target.value) || 12, 10, 72),
                              })
                            }
                          />
                        </label>
                        <div className="block-color-group">
                          <label>Text Color</label>
                          <input
                            type="color"
                            value={selectedBlock.textColor}
                            onChange={(e) => updateBlockById(selectedBlock.id, { textColor: e.target.value })}
                            className="block-color-picker"
                          />
                        </div>
                      </>
                    )}
                    <button type="button" className="delete-chip" onClick={() => removeBlock(selectedBlock.id)}>
                      Remove
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="note-board-wrap">
            <div
              className="note-board-shell"
              style={{
                width: `${Math.max(Math.round(noteCanvasSize.width * canvasZoom), 1)}px`,
                height: `${Math.max(Math.round(noteCanvasSize.height * canvasZoom), 1)}px`,
              }}
            >
              <div
                ref={boardRef}
                className="note-board"
                style={{
                  backgroundColor: noteColor,
                  width: `${noteCanvasSize.width}px`,
                  height: `${noteCanvasSize.height}px`,
                  transform: `scale(${canvasZoom})`,
                  transformOrigin: 'top left',
                }}
                onPaste={handlePasteImages}
                onMouseMove={moveDraggedBlock}
                onMouseUp={stopDraggingBlock}
                onMouseLeave={stopDraggingBlock}
                onClick={(e) => {
                  if (e.target === boardRef.current) setSelectedBlockId(null);
                }}
              >
                {noteBlocks.map((block) => (
                  <div
                    key={block.id}
                    className={`note-block ${block.type} ${selectedBlockId === block.id ? 'selected' : ''}`}
                    style={{
                      left: block.x,
                      top: block.y,
                      width: block.width,
                      height: block.height,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBlockId(block.id);
                    }}
                  >
                    <div className="note-block-head" onMouseDown={(e) => startDraggingBlock(e, block)}>
                      <span>{block.type === 'text' ? 'Text' : 'Image'}</span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(block.id);
                        }}
                      >
                        x
                      </button>
                    </div>

                    {block.type === 'text' ? (
                      <textarea
                        className="note-block-text"
                        value={block.text}
                        onChange={(e) => updateBlockById(block.id, { text: e.target.value })}
                        onPaste={handlePasteImages}
                        style={{ color: block.textColor, fontSize: `${block.fontSize}px` }}
                        placeholder="Type here..."
                      />
                    ) : (
                      <img className="note-block-image" src={block.src} alt="attachment" draggable={false} />
                    )}

                    <div className="resize-handle nw" onMouseDown={(e) => startResizingBlock(e, block, 'nw')} />
                    <div className="resize-handle ne" onMouseDown={(e) => startResizingBlock(e, block, 'ne')} />
                    <div className="resize-handle sw" onMouseDown={(e) => startResizingBlock(e, block, 'sw')} />
                    <div className="resize-handle se" onMouseDown={(e) => startResizingBlock(e, block, 'se')} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="task-editor">
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => {
                  setCompleted(e.target.checked);
                  markChanged();
                }}
              />
              <span>Mark as completed</span>
            </label>
          </div>

          <div className="form-group">
            <label>Folder</label>
            <select
              value={folderId}
              onChange={(e) => {
                setFolderId(e.target.value);
                markChanged();
              }}
              className="form-input"
            >
              <option value="">No folder</option>
              {(folders || []).map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Subject</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                markChanged();
              }}
              className="form-input"
            >
              <option value="">No subject</option>
              {(subjects || []).map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
            {subjectId && getSubjectById(subjectId) && (
              <button type="button" className="subject-link-inline" onClick={() => onOpenSubject(subjectId)}>
                Open {getSubjectById(subjectId)?.name}
              </button>
            )}
          </div>

          <div className="form-group">
            <label>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                markChanged();
              }}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={isAllDay}
                onChange={(e) => {
                  setIsAllDay(e.target.checked);
                  if (e.target.checked) {
                    setDueTime('');
                  }
                  markChanged();
                }}
              />
              <span>All Day Event</span>
            </label>
          </div>

          {!isAllDay && (
            <div className="form-group">
              <label>Due Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => {
                  setDueTime(e.target.value);
                  markChanged();
                }}
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label>Recurrence</label>
            <select
              value={recurrence}
              onChange={(e) => {
                setRecurrence(e.target.value);
                markChanged();
              }}
              className="form-input"
            >
              <option value="none">No Recurrence</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          {recurrence !== 'none' && (
            <div className="form-group">
              <label>Recurrence End Date (Optional)</label>
              <input
                type="date"
                value={recurrenceEnd}
                onChange={(e) => {
                  setRecurrenceEnd(e.target.value);
                  markChanged();
                }}
                className="form-input"
              />
            </div>
          )}

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                markChanged();
              }}
              placeholder="Add task details..."
              className="form-textarea"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Editor;
