import React, { useMemo } from 'react';
import './DayTimeline.css';

const PIXELS_PER_MINUTE = 1.05;
const MIN_EVENT_BLOCK_HEIGHT = 34;
const DEFAULT_START_MINUTE = 7 * 60;
const DEFAULT_END_MINUTE = 20 * 60;

const EVENT_TYPE_COLORS = {
  class: '#6a9fe6',
  task: '#7eb985',
  exam: '#e39a6c',
  event: '#9a8bd8',
};

const getMinutesFromDate = (value) => value.getHours() * 60 + value.getMinutes();

const toClockLabel = (value) =>
  value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

const startOfHour = (minutes) => Math.floor(minutes / 60) * 60;
const endOfHour = (minutes) => Math.ceil(minutes / 60) * 60;

function DayTimeline({ date, events, onOpenEvent }) {
  const isToday = useMemo(() => {
    const now = new Date();
    return (
      now.getFullYear() === date.getFullYear() &&
      now.getMonth() === date.getMonth() &&
      now.getDate() === date.getDate()
    );
  }, [date]);

  const nowMinute = getMinutesFromDate(new Date());

  // Separate all-day and timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay = events.filter((e) => e.isAllDay);
    const timed = events.filter((e) => !e.isAllDay);
    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  const { startMinute, endMinute, hourMarks, currentTimeY } = useMemo(() => {
    const eventStarts = timedEvents.map((event) => getMinutesFromDate(event.startTime));
    const eventEnds = timedEvents.map((event) => getMinutesFromDate(event.endTime));
    const minFromEvents = eventStarts.length ? Math.min(...eventStarts) : DEFAULT_START_MINUTE;
    const maxFromEvents = eventEnds.length ? Math.max(...eventEnds) : DEFAULT_END_MINUTE;
    const minWithPadding = Math.max(0, startOfHour(Math.min(minFromEvents, isToday ? nowMinute : minFromEvents) - 60));
    const maxWithPadding = Math.min(24 * 60, endOfHour(Math.max(maxFromEvents, isToday ? nowMinute : maxFromEvents) + 60));
    const resolvedEnd = Math.max(maxWithPadding, minWithPadding + 8 * 60);
    const marks = [];
    for (let minute = minWithPadding; minute <= resolvedEnd; minute += 60) {
      marks.push(minute);
    }

    const nowY = isToday ? (nowMinute - minWithPadding) * PIXELS_PER_MINUTE : null;

    return {
      startMinute: minWithPadding,
      endMinute: resolvedEnd,
      hourMarks: marks,
      currentTimeY: nowY,
    };
  }, [timedEvents, isToday, nowMinute]);

  const totalHeight = (endMinute - startMinute) * PIXELS_PER_MINUTE;

  return (
    <div className="day-timeline">
      {allDayEvents.length > 0 && (
        <div className="day-timeline-allday">
          <div className="allday-label">All-Day Events</div>
          <div className="allday-events">
            {allDayEvents.map((event) => {
              const tint = event.color || EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.event;
              return (
                <button
                  key={event.id}
                  type="button"
                  className={`allday-event allday-${event.type}`}
                  style={{
                    borderColor: tint,
                    background: `linear-gradient(180deg, ${tint}40 0%, ${tint}20 100%)`,
                  }}
                  onClick={() => onOpenEvent(event)}
                  title={event.title}
                >
                  <div className="allday-event-title">{event.title}</div>
                  <div className="allday-event-type">{event.type.toUpperCase()}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {timedEvents.length === 0 && allDayEvents.length === 0 ? (
        <div className="day-timeline-empty">No events scheduled for this day.</div>
      ) : null}

      <div className="day-timeline-scroll">
        <div className="day-timeline-canvas" style={{ height: `${Math.max(totalHeight, 360)}px` }}>
          {hourMarks.map((minute) => {
            const y = (minute - startMinute) * PIXELS_PER_MINUTE;
            const markerDate = new Date(date);
            markerDate.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
            return (
              <div key={minute} className="timeline-hour-line" style={{ top: `${y}px` }}>
                <span className="timeline-hour-label">{toClockLabel(markerDate)}</span>
              </div>
            );
          })}

          {isToday && currentTimeY !== null && currentTimeY >= 0 && currentTimeY <= totalHeight ? (
            <div className="timeline-now-line" style={{ top: `${currentTimeY}px` }}>
              <span>Now</span>
            </div>
          ) : null}

          {timedEvents.map((event) => {
            const start = getMinutesFromDate(event.startTime);
            const end = getMinutesFromDate(event.endTime);
            const top = (start - startMinute) * PIXELS_PER_MINUTE;
            const height = Math.max((end - start) * PIXELS_PER_MINUTE, MIN_EVENT_BLOCK_HEIGHT);
            const tint = event.color || EVENT_TYPE_COLORS[event.type] || EVENT_TYPE_COLORS.event;

            return (
              <button
                key={event.id}
                type="button"
                className={`timeline-event timeline-${event.type}`}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  borderColor: tint,
                  background: `linear-gradient(180deg, ${tint}26 0%, ${tint}12 100%)`,
                }}
                onClick={() => onOpenEvent(event)}
                title={`${event.title} (${toClockLabel(event.startTime)} - ${toClockLabel(event.endTime)})`}
              >
                <div className="timeline-event-title">{event.title}</div>
                <div className="timeline-event-meta">
                  {toClockLabel(event.startTime)} - {toClockLabel(event.endTime)}
                </div>
                <div className="timeline-event-type">{event.type.toUpperCase()}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DayTimeline;
