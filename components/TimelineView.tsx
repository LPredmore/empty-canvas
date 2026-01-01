import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { format } from 'date-fns';
import { MessageSquare, Calendar, Loader2 } from 'lucide-react';
import { Message, Event, Person } from '../types';

export const TimelineView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getMessages(), 
      api.getEvents(),
      api.getPeople()
    ]).then(([messages, events, people]) => {
      const combined = [
        ...messages.map(m => {
          const person = people.find(p => p.id === m.senderId);
          return { type: 'message', data: m, date: m.sentAt, authorName: person ? person.fullName : 'Unknown' };
        }),
        ...events.map(e => ({ type: 'event', data: e, date: e.date, authorName: null }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setItems(combined);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex p-8 justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-8">Global Timeline</h2>
      
      {items.length === 0 ? (
        <div className="text-slate-500 text-center">No timeline activity found.</div>
      ) : (
        <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
          {items.map((item, index) => {
            const isEvent = item.type === 'event';
            const date = new Date(item.date);
            const formattedDate = format(date, 'MMM d, yyyy');
            const formattedTime = format(date, 'h:mm a');
            
            let title, content, icon;
            
            if (isEvent) {
               const evt = item.data;
               title = evt.title;
               content = evt.description;
               icon = <Calendar className="w-5 h-5 text-emerald-600" />;
            } else {
               const msg = item.data;
               title = `Message from ${item.authorName}`;
               content = msg.rawText;
               icon = <MessageSquare className="w-5 h-5 text-indigo-600" />;
            }

            return (
              <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                
                {/* Icon */}
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                  {icon}
                </div>
                
                {/* Content Card */}
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between space-x-2 mb-1">
                    <span className="font-bold text-slate-900 text-sm">{title}</span>
                    <time className="font-mono text-xs text-slate-500">{formattedDate}</time>
                  </div>
                  <div className="text-slate-600 text-sm leading-snug">
                     {content}
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                     {formattedTime}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};