import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const DAYS = ['Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const EVENT_COLORS = [
    { bg: '#F3F4F6', text: '#374151' }, // Default Gray
    { bg: '#F5F3FF', text: '#7C3AED' }, // Purple
    { bg: '#EEF2FF', text: '#4F46E5' }, // Blue
    { bg: '#FDF2F8', text: '#DB2777' }, // Pink
    { bg: '#ECFDF5', text: '#059669' }, // Green
    { bg: '#FFF7ED', text: '#D97706' }, // Orange
    { bg: '#EFF6FF', text: '#2563EB' }, // High Blue
];

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0=Mon, 6=Sun
}

export default function GoogleCalendar() {
    const { backendToken, currentUser } = useAuth();
    const todayDate = new Date();
    const [viewDate, setViewDate] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('All events');
    const [searchQuery, setSearchQuery] = useState('');
    const [status, setStatus] = useState(null);
    const [newEvent, setNewEvent] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00', description: '' });
    const [creating, setCreating] = useState(false);

    const { year, month } = viewDate;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const fetchLiveEvents = useCallback(async () => {
        setLoading(true);
        try {
            const startOfMonth = new Date(year, month, 1).toISOString();
            const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
            
            const res = await fetch(`${API_URL}/google/calendar/events?timeMin=${startOfMonth}&timeMax=${endOfMonth}&maxResults=250`, {
                headers: { 'Authorization': `Bearer ${backendToken}` }
            });
            const data = await res.json();
            
            if (data.success && data.events) {
                const mapped = data.events.map((ev, idx) => {
                    const start = ev.start?.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date);
                    const colorIdx = (ev.summary?.length || 0) % EVENT_COLORS.length;
                    return {
                        id: ev.id,
                        title: ev.summary || '(No Title)',
                        time: ev.start?.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'All Day',
                        date: start.getDate(),
                        month: start.getMonth(),
                        year: start.getFullYear(),
                        color: EVENT_COLORS[colorIdx].bg,
                        textColor: EVENT_COLORS[colorIdx].text,
                        dot: ev.status === 'confirmed' && idx % 3 === 0 // Logic for visual dots
                    };
                });
                setEvents(mapped);
            } else if (data.message && data.message.includes('No Google access token')) {
                setStatus({ type: 'error', message: 'Google Account not connected. Showing Preview.' });
            }
        } catch (err) {
            console.error("Calendar fetch error:", err);
            setStatus({ type: 'error', message: 'Backend not reachable. Demo data loaded.' });
        } finally {
            setLoading(false);
        }
    }, [year, month, backendToken]);

    useEffect(() => {
        fetchLiveEvents();
    }, [fetchLiveEvents]);

    const handleCreateEvent = async () => {
        if (!newEvent.title || !newEvent.date) return;
        setCreating(true);
        try {
            const start = new Date(`${newEvent.date}T${newEvent.startTime}:00`).toISOString();
            const end = new Date(`${newEvent.date}T${newEvent.endTime}:00`).toISOString();
            
            const res = await fetch(`${API_URL}/google/calendar/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${backendToken}` },
                body: JSON.stringify({
                    summary: newEvent.title,
                    description: newEvent.description,
                    start,
                    end
                }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: 'Event synchronized with Google.' });
                fetchLiveEvents();
                setShowModal(false);
                setNewEvent({ title: '', date: '', startTime: '09:00', endTime: '10:00', description: '' });
            } else {
                setStatus({ type: 'error', message: data.message || 'Sync failed.' });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Creation failed.' });
        } finally {
            setCreating(false);
            setTimeout(() => setStatus(null), 5000);
        }
    };

    const navigateMonth = (dir) => {
        setViewDate(prev => {
            const d = new Date(prev.year, prev.month + dir, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
    };

    const goToday = () => {
        setViewDate({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
    };

    const filteredEvents = events.filter(e => 
        e.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderCell = (dayNum, isCurrentMonth, cellMonth, cellYear) => {
        const dayEvents = filteredEvents.filter(e => e.date === dayNum && e.month === cellMonth && e.year === cellYear);
        const displayEvents = dayEvents.slice(0, 3);
        const moreCount = dayEvents.length > 3 ? dayEvents.length - 3 : 0;
        const isTodayCell = dayNum === todayDate.getDate() && cellMonth === todayDate.getMonth() && cellYear === todayDate.getFullYear();

        return (
            <div className={`cal-grid-cell ${!isCurrentMonth ? 'out-of-month' : ''}`}>
                <div className="cell-header">
                    <span className={`day-number ${isTodayCell ? 'today-pill' : ''}`}>{dayNum}</span>
                </div>
                <div className="cell-events">
                    {displayEvents.map((ev, i) => (
                        <div key={i} className="event-pill" style={{ backgroundColor: ev.color, color: ev.textColor }}>
                            {ev.dot && <span className="event-dot" style={{ backgroundColor: ev.textColor }}></span>}
                            <span className="event-title-small">{ev.title}</span>
                            <span className="event-time-small">{ev.time}</span>
                        </div>
                    ))}
                    {moreCount > 0 && <div className="event-more">{moreCount} more...</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="full-calendar-container">
            <style>{`
                .full-calendar-container { font-family: 'Inter', sans-serif; background: #fff; height: 100%; display: flex; flex-direction: column; overflow: hidden; }
                
                .cal-top-bar { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #F1F5F9; }
                .cal-main-title { font-size: 1.25rem; font-weight: 800; color: #111827; margin: 0; letter-spacing: -0.02em; }
                
                .search-shortcut-box { display: flex; align-items: center; background: #fff; border: 1.5px solid #F1F5F9; border-radius: 8px; padding: 0.4rem 0.75rem; width: 220px; transition: all 0.2s; }
                .search-shortcut-box:focus-within { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                .search-input { border: none; flex: 1; outline: none; font-size: 0.8rem; font-weight: 600; color: #111827; }
                .shortcut-tag { background: #F8FAFC; color: #94A3B8; font-size: 0.65rem; font-weight: 800; padding: 1px 4px; border-radius: 4px; border: 1px solid #E2E8F0; }

                .filter-tabs { display: flex; gap: 0.5rem; margin-top: 0.75rem; padding: 0 1.5rem; }
                .filter-tab { border: 1px solid #F1F5F9; background: #fff; padding: 0.35rem 0.85rem; border-radius: 8px; font-size: 0.75rem; font-weight: 700; color: #64748B; cursor: pointer; transition: all 0.2s; }
                .filter-tab.active { background: #111827; color: #fff; border-color: #111827; }

                .cal-nav-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; }
                .nav-left { display: flex; align-items: center; gap: 1rem; }
                .nav-date-pod { background: #fff; border: 1.2px solid #F1F5F9; border-radius: 10px; padding: 0.4rem 0.8rem; text-align: center; line-height: 1.1; box-shadow: 0 2px 6px rgba(0,0,0,0.02); }
                .nav-date-pod .month { font-size: 0.65rem; color: #64748B; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
                .nav-date-pod .year { font-size: 0.9rem; color: #111827; font-weight: 900; }
                
                .month-range-label { font-size: 1.1rem; font-weight: 800; color: #111827; letter-spacing: -0.01em; }
                .month-range-sub { font-size: 0.72rem; color: #94A3B8; font-weight: 600; margin-top: 0.1rem; }

                .nav-right { display: flex; align-items: center; gap: 0.6rem; }
                .icon-btn { border: 1.2px solid #F1F5F9; background: #fff; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748B; cursor: pointer; transition: all 0.2s; font-size: 0.8rem; }
                .icon-btn:hover { background: #F8FAFC; border-color: #E2E8F0; }
                .today-btn { border: 1.2px solid #F1F5F9; background: #fff; padding: 0.45rem 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; color: #111827; cursor: pointer; }
                .view-dropdown { border: 1.2px solid #F1F5F9; background: #fff; padding: 0.45rem 0.85rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; color: #111827; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
                .add-event-btn { background: #111827; color: #fff; border: none; padding: 0.5rem 1.1rem; border-radius: 8px; font-weight: 800; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 3px 8px rgba(0,0,0,0.1); }

                .cal-grid-wrapper { flex: 1; display: flex; flex-direction: column; padding: 0 1.5rem 1.5rem 1.5rem; }
                .cal-grid-header-row { display: grid; grid-template-columns: repeat(7, 1fr); border: 1px solid #F1F5F9; border-bottom: none; background: #F8FAFC; border-radius: 10px 10px 0 0; }
                .grid-header-cell { padding: 0.65rem; text-align: center; font-size: 0.65rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-right: 1px solid #F1F5F9; }
                .grid-header-cell:last-child { border-right: none; }

                .cal-month-grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); grid-template-rows: repeat(5, 1fr); border: 1px solid #F1F5F9; border-radius: 0 0 10px 10px; overflow: hidden; }
                .cal-grid-cell { border-right: 1px solid #F1F5F9; border-bottom: 1px solid #F1F5F9; padding: 0.6rem; display: flex; flex-direction: column; gap: 4px; min-height: 90px; background: #fff; transition: background 0.2s; }
                .cal-grid-cell:hover { background: #FCFCFD; }
                .cal-grid-cell:nth-child(7n) { border-right: none; }
                .out-of-month { background: #F9FAFB; }
                .out-of-month .day-number { color: #D1D5DB; }

                .day-number { font-size: 0.8rem; font-weight: 800; color: #64748B; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
                .today-pill { background: #111827; color: #fff !important; border-radius: 50%; box-shadow: 0 3px 6px rgba(0,0,0,0.2); }

                .event-pill { border-radius: 6px; padding: 3px 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; font-weight: 700; letter-spacing: -0.01em; cursor: pointer; transition: transform 0.2s; margin-bottom: 1px; }
                .event-pill:hover { transform: scale(1.02); }
                .event-dot { width: 5px; height: 5px; border-radius: 50%; margin-right: 6px; flex-shrink: 0; }
                .event-title-small { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .event-time-small { margin-left: 6px; opacity: 0.7; font-weight: 600; font-size: 0.6rem; flex-shrink: 0; }
                .event-more { font-size: 0.68rem; font-weight: 800; color: #6366F1; padding: 1px 6px; cursor: pointer; }

                .status-toast { position: fixed; bottom: 1.5rem; right: 1.5rem; padding: 0.75rem 1.25rem; border-radius: 10px; font-weight: 800; z-index: 2000; animation: slideUp 0.3s ease-out; font-size: 0.8rem; }
                .status-toast.success { background: #10B981; color: #fff; }
                .status-toast.error { background: #EF4444; color: #fff; }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                body.theme-dark .full-calendar-container { background: #000; }
                body.theme-dark .cal-grid-cell, body.theme-dark .cal-grid-header-row { background: #000; border-color: #18181B; }
                body.theme-dark .out-of-month { background: #09090B; }
                body.theme-dark .cal-main-title, body.theme-dark .month-range-label, body.theme-dark .nav-date-pod .year { color: #fff; }
                body.theme-dark .today-pill { background: #fff; color: #000 !important; }
                body.theme-dark .search-shortcut-box, body.theme-dark .icon-btn, body.theme-dark .today-btn, body.theme-dark .view-dropdown { background: #000; border-color: #18181B; }
                body.theme-dark .search-input { background: transparent; color: #fff; }
            `}</style>

            {status && <div className={`status-toast ${status.type}`}>{status.message}</div>}

            <header className="cal-top-bar">
                <h1 className="cal-main-title">Calendar</h1>
                <div className="search-shortcut-box">
                    <svg style={{marginRight: '12px'}} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="search-input" placeholder="Search events..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <span className="shortcut-tag">⌘K</span>
                </div>
            </header>

            <div className="filter-tabs">
                {['All events', 'Shared', 'Public', 'Archived'].map(tab => (
                    <button key={tab} className={`filter-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
                ))}
            </div>

            <div className="cal-nav-header">
                <div className="nav-left">
                    <div className="nav-date-pod">
                        <div className="month">{MONTHS[month].substring(0, 3)}</div>
                        <div className="year">{year}</div>
                    </div>
                    <div>
                        <div className="month-range-label">{MONTHS[month]} {year}</div>
                        <div className="month-range-sub">{MONTHS[month]} 1, {year} – {MONTHS[month]} {daysInMonth}, {year}</div>
                    </div>
                </div>
                <div className="nav-right">
                    <button className="icon-btn">🔍</button>
                    <div className="nav-right" style={{gap: '0.6rem'}}>
                        <button className="icon-btn" onClick={() => navigateMonth(-1)}>‹</button>
                        <button className="today-btn" onClick={goToday}>Today</button>
                        <button className="icon-btn" onClick={() => navigateMonth(1)}>›</button>
                    </div>
                    <div className="view-dropdown">
                        Month view <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                    <button className="add-event-btn" onClick={() => setShowModal(true)}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Add event
                    </button>
                </div>
            </div>

            <div className="cal-grid-wrapper">
                <div className="cal-grid-header-row">
                    {DAYS.map(d => <div key={d} className="grid-header-cell">{d}</div>)}
                </div>
                <div className="cal-month-grid">
                    {/* Previous Month filler */}
                    {(() => {
                        const prevYear = month === 0 ? year - 1 : year;
                        const prevMonth = month === 0 ? 11 : month - 1;
                        const prevDaysCount = getDaysInMonth(prevYear, prevMonth);
                        return Array.from({ length: firstDay }).map((_, i) => renderCell(prevDaysCount - (firstDay - i - 1), false, prevMonth, prevYear));
                    })()}
                    
                    {/* Current Month days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => renderCell(i + 1, true, month, year))}
                    
                    {/* Next Month filler */}
                    {(() => {
                        const nextYear = month === 11 ? year + 1 : year;
                        const nextMonth = month === 11 ? 0 : month + 1;
                        const remaining = 35 - (firstDay + daysInMonth); // standard 5 row grid
                        const actualRemaining = remaining < 0 ? 42 - (firstDay + daysInMonth) : remaining;
                        return Array.from({ length: actualRemaining }).map((_, i) => renderCell(i + 1, false, nextMonth, nextYear));
                    })()}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }} onClick={() => setShowModal(false)}>
                    <div style={{ background: 'white', padding: '2.5rem', borderRadius: '28px', width: '450px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ margin: '0 0 1.5rem 0', fontWeight: 900, color: '#111827' }}>Create New Event</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="form-pod">
                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Title</label>
                                <input className="modal-input" placeholder="e.g. Research Seminar" style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #F1F5F9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} value={newEvent.title} onChange={e=>setNewEvent({...newEvent, title: e.target.value})} />
                            </div>
                            <div className="form-pod">
                                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Date</label>
                                <input type="date" style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #F1F5F9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} value={newEvent.date} onChange={e=>setNewEvent({...newEvent, date: e.target.value})} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Start</label>
                                    <input type="time" style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #F1F5F9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} value={newEvent.startTime} onChange={e=>setNewEvent({...newEvent, startTime: e.target.value})} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase' }}>End</label>
                                    <input type="time" style={{ width: '100%', padding: '0.9rem', borderRadius: '12px', border: '1.5px solid #F1F5F9', outline: 'none', fontSize: '1rem', fontWeight: 600 }} value={newEvent.endTime} onChange={e=>setNewEvent({...newEvent, endTime: e.target.value})} />
                                </div>
                            </div>
                            <button style={{ width: '100%', padding: '1.1rem', borderRadius: '14px', border: 'none', background: '#111827', color: 'white', fontWeight: 900, fontSize: '1rem', marginTop: '1rem', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' }} onClick={handleCreateEvent}>
                                {creating ? 'Syncing...' : 'Synchronize Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
