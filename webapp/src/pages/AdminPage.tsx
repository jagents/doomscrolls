import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Database, TrendingUp, Settings, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface DatasetStats {
  chunks: number;
  works: number;
  authors: number;
  curatedWorks: number;
  categories: number;
  categoryBreakdown: Array<{
    name: string;
    slug: string;
    icon: string;
    workCount: number;
  }>;
}

interface FeedStats {
  totalLikes: number;
  totalViews: number;
  topPassages: Array<{
    id: string;
    text: string;
    authorName: string;
    workTitle: string | null;
    likeCount: number;
  }>;
}

interface FeedConfig {
  maxAuthorRepeat: number;
  maxWorkRepeat: number;
  minLength: number;
  maxLength: number;
}

type TabType = 'dataset' | 'feed' | 'algorithm';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dataset');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);
  const [feedStats, setFeedStats] = useState<FeedStats | null>(null);
  const [config, setConfig] = useState<FeedConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<FeedConfig | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, configRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminConfig()
      ]);
      setDatasetStats(statsRes.dataset);
      setFeedStats(statsRes.feed);
      setConfig(configRes.config);
      setConfigDraft(configRes.config);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveConfig = async () => {
    if (!configDraft) return;
    setSaving(true);
    try {
      const res = await api.updateAdminConfig(configDraft);
      setConfig(res.config);
      setConfigDraft(res.config);
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const hasConfigChanges = config && configDraft &&
    JSON.stringify(config) !== JSON.stringify(configDraft);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'dataset', label: 'Dataset', icon: <Database className="w-4 h-4" /> },
    { id: 'feed', label: 'Feed Stats', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'algorithm', label: 'Algorithm', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary/80 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-secondary rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 hover:bg-secondary rounded-full disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors
              ${activeTab === tab.id
                ? 'text-accent border-b-2 border-accent'
                : 'text-secondary hover:bg-secondary/50'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 skeleton rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {activeTab === 'dataset' && datasetStats && (
              <DatasetTab stats={datasetStats} />
            )}
            {activeTab === 'feed' && feedStats && (
              <FeedTab stats={feedStats} />
            )}
            {activeTab === 'algorithm' && configDraft && (
              <AlgorithmTab
                config={configDraft}
                onChange={setConfigDraft}
                onSave={handleSaveConfig}
                saving={saving}
                hasChanges={hasConfigChanges || false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DatasetTab({ stats }: { stats: DatasetStats }) {
  const mainStats = [
    { label: 'Total Passages', value: stats.chunks.toLocaleString() },
    { label: 'Works', value: stats.works.toLocaleString() },
    { label: 'Authors', value: stats.authors.toLocaleString() },
    { label: 'Curated Works', value: stats.curatedWorks.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {mainStats.map((stat) => (
          <div key={stat.label} className="bg-secondary rounded-xl p-4">
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm text-secondary">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="font-bold mb-3">Categories ({stats.categories})</h3>
        <div className="space-y-2">
          {stats.categoryBreakdown.map((cat) => (
            <div
              key={cat.slug}
              className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </div>
              <span className="text-secondary">{cat.workCount} works</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeedTab({ stats }: { stats: FeedStats }) {
  return (
    <div className="space-y-6">
      {/* Engagement stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondary rounded-xl p-4">
          <div className="text-2xl font-bold">{stats.totalLikes.toLocaleString()}</div>
          <div className="text-sm text-secondary">Total Likes</div>
        </div>
        <div className="bg-secondary rounded-xl p-4">
          <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
          <div className="text-sm text-secondary">Total Views</div>
        </div>
      </div>

      {/* Top passages */}
      <div>
        <h3 className="font-bold mb-3">Most Liked Passages</h3>
        {stats.topPassages.length === 0 ? (
          <p className="text-secondary">No liked passages yet</p>
        ) : (
          <div className="space-y-3">
            {stats.topPassages.map((passage, i) => (
              <div
                key={passage.id}
                className="bg-secondary/50 rounded-lg p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg font-bold text-secondary">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-2">{passage.text}...</p>
                    <p className="text-xs text-secondary mt-1">
                      {passage.authorName}
                      {passage.workTitle && ` - ${passage.workTitle}`}
                    </p>
                  </div>
                  <span className="text-like font-bold">{passage.likeCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AlgorithmTabProps {
  config: FeedConfig;
  onChange: (config: FeedConfig) => void;
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}

function AlgorithmTab({ config, onChange, onSave, saving, hasChanges }: AlgorithmTabProps) {
  const handleChange = (key: keyof FeedConfig, value: number) => {
    onChange({ ...config, [key]: value });
  };

  const settings = [
    {
      key: 'maxAuthorRepeat' as const,
      label: 'Author Diversity',
      description: 'Same author can appear max 1 in N passages',
      min: 1,
      max: 50,
    },
    {
      key: 'maxWorkRepeat' as const,
      label: 'Work Diversity',
      description: 'Same work can appear max 1 in N passages',
      min: 1,
      max: 100,
    },
    {
      key: 'minLength' as const,
      label: 'Min Passage Length',
      description: 'Minimum characters per passage',
      min: 1,
      max: 500,
    },
    {
      key: 'maxLength' as const,
      label: 'Max Passage Length',
      description: 'Maximum characters per passage',
      min: 100,
      max: 5000,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {settings.map((setting) => (
          <div key={setting.key} className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium">{setting.label}</label>
              <input
                type="number"
                min={setting.min}
                max={setting.max}
                value={config[setting.key]}
                onChange={(e) => handleChange(setting.key, parseInt(e.target.value) || setting.min)}
                className="w-24 px-3 py-1 bg-primary border border-border rounded-lg text-right"
              />
            </div>
            <p className="text-sm text-secondary">{setting.description}</p>
            <input
              type="range"
              min={setting.min}
              max={setting.max}
              value={config[setting.key]}
              onChange={(e) => handleChange(setting.key, parseInt(e.target.value))}
              className="w-full mt-2 accent-accent"
            />
          </div>
        ))}
      </div>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={!hasChanges || saving}
        className={`w-full py-3 rounded-full font-bold transition-colors
          ${hasChanges
            ? 'bg-accent text-white hover:opacity-90'
            : 'bg-secondary text-secondary cursor-not-allowed'}`}
      >
        {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
      </button>
    </div>
  );
}
