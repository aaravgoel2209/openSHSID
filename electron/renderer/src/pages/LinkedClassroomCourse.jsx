import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react/spinner';
import { AuthContext } from '../context/authContext';
import { getCourse, downloadResourceUrl } from '../api/crawler';

const LC_TEAL = '#00a9ce';
const LC_ORANGE = '#ED8B00';

// FontAwesome → Bootstrap Icons mapping for activity types
const MOD_ICON = {
  assign:      'bi-pencil-square',
  quiz:        'bi-question-circle-fill',
  offlinequiz: 'bi-list-check',
  resource:    'bi-file-earmark-text',
  page:        'bi-file-earmark',
  folder:      'bi-folder-fill',
  url:         'bi-link-45deg',
  label:       'bi-tag-fill',
  lesson:      'bi-book-fill',
  feedback:    'bi-chat-dots-fill',
  hotquestion: 'bi-fire',
  forum:       'bi-people-fill',
  glossary:    'bi-journal-text',
  scorm:       'bi-layers-fill',
  lti:         'bi-box-arrow-up-right',
};

// fa-* → bi-* for tile icons
const FA_TO_BI = {
  'fa-pie-chart':    'bi-pie-chart-fill',
  'fa-book':         'bi-book-fill',
  'fa-pencil':       'bi-pencil-fill',
  'fa-file':         'bi-file-earmark',
  'fa-folder':       'bi-folder-fill',
  'fa-list':         'bi-list-ul',
  'fa-calendar':     'bi-calendar3',
  'fa-star':         'bi-star-fill',
  'fa-globe':        'bi-globe',
  'fa-video-camera': 'bi-camera-video-fill',
  'fa-music':        'bi-music-note-beamed',
  'fa-picture-o':    'bi-image',
  'fa-film':         'bi-film',
  'fa-link':         'bi-link-45deg',
  'fa-check':        'bi-check-circle-fill',
  'fa-question':     'bi-question-circle-fill',
  'fa-info':         'bi-info-circle-fill',
  'fa-users':        'bi-people-fill',
  'fa-trophy':       'bi-trophy-fill',
  'fa-flask':        'bi-eyedropper',
  'fa-cog':          'bi-gear-fill',
};

function tileGradient(title) {
  const PALETTES = [
    ['#4f46e5','#7c3aed'],['#0891b2','#0e7490'],['#059669','#047857'],
    ['#d97706','#b45309'],['#dc2626','#b91c1c'],['#7c3aed','#6d28d9'],
    ['#0284c7','#0369a1'],['#16a34a','#15803d'],
  ];
  const idx = Math.abs((title || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0)) % PALETTES.length;
  const [a, b] = PALETTES[idx];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function SectionTile({ section, isOpen, onToggle }) {
  const [hovered, setHovered] = useState(false);
  const hasPhoto = !!section.photo_url;
  const biIcon = FA_TO_BI[section.tile_icon] || 'bi-grid-fill';

  const handleImgError = (e) => {
    if (section.photo_proxy_url && e.target.src !== window.location.origin + section.photo_proxy_url) {
      e.target.src = section.photo_proxy_url;
    }
  };

  return (
    <div
      style={{
        borderTop: `4px solid ${hovered || isOpen ? LC_ORANGE : LC_TEAL}`,
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
        cursor: 'pointer',
        borderRadius: 14,
        position: 'relative',
        overflow: 'hidden',
        width: 200,
        height: 150,
        flexShrink: 0,
        boxShadow: hovered || isOpen
          ? '0 8px 28px rgba(0,169,206,0.18), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 2px 10px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-3px)' : 'none',
      }}
      className={`border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-md select-none${hasPhoto ? '' : ' bg-white/55 dark:bg-gray-800/70'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onToggle}
    >
      {hasPhoto ? (
        <>
          <img
            src={section.photo_url}
            alt=""
            onError={handleImgError}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: `${LC_TEAL}ee`,
            padding: '6px 10px',
          }}>
            <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
              {section.title}
            </p>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-2 p-3">
          <i className={`bi ${biIcon}`} style={{ fontSize: 28, color: LC_TEAL }} />
          <p style={{ fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.3, margin: 0 }}
             className="text-gray-700 dark:text-gray-200">
            {section.title}
          </p>
        </div>
      )}
      {isOpen && (
        <div style={{
          position: 'absolute', top: 4, right: 6,
          width: 10, height: 10, borderRadius: '50%',
          background: LC_ORANGE,
        }} />
      )}
    </div>
  );
}

const DOWNLOADABLE = new Set(['resource', 'folder']);

function ActivityRow({ act }) {
  const icon = MOD_ICON[act.modtype] || 'bi-file-earmark';
  const canDownload = DOWNLOADABLE.has(act.modtype) && act.url && !act.restricted;

  const handleDownload = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = downloadResourceUrl(act.url);
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <a
      href={act.url || '#'}
      target={act.url ? '_blank' : undefined}
      rel="noreferrer"
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors no-underline group"
      style={{ opacity: act.restricted ? 0.5 : 1 }}
    >
      <i className={`bi ${icon} shrink-0`} style={{ color: LC_TEAL, fontSize: 16 }} />
      <span className="text-sm text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate flex-1">
        {act.title || '(无标题)'}
      </span>
      {act.restricted && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 shrink-0">受限</span>
      )}
      {canDownload && (
        <button
          onClick={handleDownload}
          title="下载"
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          style={{ color: LC_TEAL, lineHeight: 1 }}
        >
          <i className="bi bi-download text-sm" />
        </button>
      )}
      {act.url && !act.restricted && !canDownload && (
        <i className="bi bi-box-arrow-up-right shrink-0 text-gray-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </a>
  );
}

export default function LinkedClassroomCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    getCourse(courseId).then(setCourse).catch(() => setCourse(null)).finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20"><Spinner size="lg" /></div>
    );
  }
  if (!course) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p>课程未找到或尚未同步。</p>
        <button onClick={() => navigate('/linkedclassroom')} className="mt-3 text-sm text-blue-500 hover:underline">← 返回</button>
      </div>
    );
  }

  const openSec = course.sections?.find(s => s.id === openSection);

  return (
    <div className="animate-fade-in" style={{ fontFamily: "'Poppins', sans-serif" }}>
      {/* LC-style course header */}
      <div className="rounded-xl overflow-hidden mb-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div style={{ background: `linear-gradient(90deg, ${LC_TEAL}, #0077a8)`, padding: '16px 24px' }}>
          <button onClick={() => navigate('/linkedclassroom')}
            className="text-white/70 text-xs hover:text-white mb-1 flex items-center gap-1">
            <i className="bi bi-chevron-left" /> LinkedClassroom
          </button>
          <h1 className="text-white text-2xl font-bold m-0">{course.title}</h1>
        </div>
        {course.summary && (
          <div className="bg-white dark:bg-gray-900 px-6 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{course.summary}</p>
          </div>
        )}
      </div>

      {/* Tile grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {course.sections?.map(sec => (
          <SectionTile
            key={sec.id}
            section={sec}
            isOpen={openSection === sec.id}
            onToggle={() => setOpenSection(openSection === sec.id ? null : sec.id)}
          />
        ))}
        {/* spacers */}
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ width: 200, height: 0 }} aria-hidden />
        ))}
      </div>

      {/* Expanded section content — renders below tiles like LC */}
      {openSec && (
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm animate-fade-in">
          <div style={{ background: LC_TEAL, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 15, fontWeight: 700 }}>{openSec.title}</h2>
            <button onClick={() => setOpenSection(null)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>
              <i className="bi bi-x" />
            </button>
          </div>
          {openSec.activities?.length === 0 ? (
            <p className="text-sm text-gray-400 px-4 py-6 text-center bg-white dark:bg-gray-900">此章节暂无内容</p>
          ) : (
            <div className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {openSec.activities.map(act => (
                <ActivityRow key={act.id} act={act} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center">
        上次同步：{course.last_synced?.slice(0, 10)} ·{' '}
        <a href={`https://www.linkedclassroom.com/course/view.php?id=${courseId}`}
           target="_blank" rel="noreferrer" className="hover:underline">在 LinkedClassroom 中打开</a>
      </p>
    </div>
  );
}
