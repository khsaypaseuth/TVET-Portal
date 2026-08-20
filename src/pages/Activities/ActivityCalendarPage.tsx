import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useTranslation } from 'react-i18next';
import PageMeta from '../../components/common/PageMeta';
import { apiService } from '../../services/api';
import { useNavigate } from 'react-router';

export default function ActivityCalendarPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    apiService.getActivities().then((r) => {
      setEvents(
        r.data.map((a: any) => ({
          id: String(a.id),
          title: i18n.language === 'en' && a.title_en ? a.title_en : a.title_lo,
          start: a.is_all_day
            ? String(a.start_date).slice(0, 10)
            : `${String(a.start_date).slice(0, 10)}T${String(a.start_time || '00:00').slice(0, 5)}:00`,
          end: a.is_all_day
            ? String(a.end_date).slice(0, 10)
            : `${String(a.end_date).slice(0, 10)}T${String(a.end_time || '23:59').slice(0, 5)}:00`,
          backgroundColor: a.type_colour || '#3B82F6',
          allDay: !!a.is_all_day,
        }))
      );
    });
  }, [i18n.language]);

  return (
    <>
      <PageMeta title={`${t('sidebar.calendar')} | TVED`} description={t('app.fullName')} />
      <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white/90">{t('sidebar.calendar')}</h1>
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          events={events}
          eventClick={(info) => navigate(`/activities/${info.event.id}`)}
          height="auto"
        />
      </div>
    </>
  );
}
