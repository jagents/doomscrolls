import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Database, TrendingUp, Settings, RefreshCw, Users, Sparkles, Sliders, Brain, Zap } from 'lucide-react';
import { api } from '../services/api';
import type { FeedAlgorithmConfig } from '../services/api';

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

interface Phase2Stats {
  users: {
    total: number;
    activeThisWeek: number;
    withLikes: number;
    withFollows: number;
  };
  embeddings: {
    total: number;
    withEmbeddings: number;
    percentComplete: number;
  };
  lists: {
    total: number;
    curated: number;
    totalPassagesInLists: number;
  };
  follows: {
    totalFollows: number;
    topAuthors: Array<{ name: string; slug: string; followers: number }>;
  };
}

type TabType = 'dataset' | 'feed' | 'users' | 'algorithm';

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dataset');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datasetStats, setDatasetStats] = useState<DatasetStats | null>(null);
  const [feedStats, setFeedStats] = useState<FeedStats | null>(null);
  const [phase2Stats, setPhase2Stats] = useState<Phase2Stats | null>(null);
  const [config, setConfig] = useState<FeedAlgorithmConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<FeedAlgorithmConfig | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, configRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminConfig()
      ]);
      setDatasetStats(statsRes.dataset);
      setFeedStats(statsRes.feed);
      setPhase2Stats(statsRes.phase2);
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
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
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
            {activeTab === 'users' && phase2Stats && (
              <UsersTab stats={phase2Stats} />
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
  config: FeedAlgorithmConfig;
  onChange: (config: FeedAlgorithmConfig) => void;
  onSave: () => void;
  saving: boolean;
  hasChanges: boolean;
}

function AlgorithmTab({ config, onChange, onSave, saving, hasChanges }: AlgorithmTabProps) {
  const handleChange = (key: keyof FeedAlgorithmConfig, value: number | boolean) => {
    onChange({ ...config, [key]: value });
  };

  const diversitySettings = [
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

  const lengthBucketSettings = [
    {
      key: 'shortMaxLength' as const,
      label: 'Short Max',
      description: 'Passages up to this length are "short"',
      min: 10,
      max: 500,
    },
    {
      key: 'longMinLength' as const,
      label: 'Long Min',
      description: 'Passages at least this length are "long"',
      min: 200,
      max: 2000,
    },
  ];

  const ratioSettings = [
    { key: 'shortRatio' as const, label: 'Short %', color: 'text-green-500' },
    { key: 'mediumRatio' as const, label: 'Medium %', color: 'text-yellow-500' },
    { key: 'longRatio' as const, label: 'Long %', color: 'text-blue-500' },
  ];

  const totalRatio = config.shortRatio + config.mediumRatio + config.longRatio;

  return (
    <div className="space-y-6">
      {/* Content Diversity Section */}
      <div>
        <h3 className="font-bold text-lg mb-4">Content Diversity</h3>
        <div className="space-y-4">
          {diversitySettings.map((setting) => (
            <div key={setting.key} className="bg-secondary/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium">{setting.label}</label>
                <input
                  type="number"
                  min={setting.min}
                  max={setting.max}
                  value={config[setting.key] as number}
                  onChange={(e) => handleChange(setting.key, parseInt(e.target.value) || setting.min)}
                  className="w-24 px-3 py-1 bg-primary border border-border rounded-lg text-right"
                />
              </div>
              <p className="text-sm text-secondary">{setting.description}</p>
              <input
                type="range"
                min={setting.min}
                max={setting.max}
                value={config[setting.key] as number}
                onChange={(e) => handleChange(setting.key, parseInt(e.target.value))}
                className="w-full mt-2 accent-accent"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Length Diversity Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Length Diversity</h3>
          <button
            onClick={() => handleChange('lengthDiversityEnabled', !config.lengthDiversityEnabled)}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
              config.lengthDiversityEnabled
                ? 'bg-accent text-white'
                : 'bg-secondary text-secondary'
            }`}
          >
            {config.lengthDiversityEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {config.lengthDiversityEnabled && (
          <div className="space-y-4">
            {/* Bucket boundaries */}
            <div className="grid grid-cols-2 gap-4">
              {lengthBucketSettings.map((setting) => (
                <div key={setting.key} className="bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-medium text-sm">{setting.label}</label>
                    <input
                      type="number"
                      min={setting.min}
                      max={setting.max}
                      value={config[setting.key] as number}
                      onChange={(e) => handleChange(setting.key, parseInt(e.target.value) || setting.min)}
                      className="w-20 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                    />
                  </div>
                  <p className="text-xs text-secondary">{setting.description}</p>
                </div>
              ))}
            </div>

            {/* Ratio sliders */}
            <div className="bg-secondary/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Target Mix</span>
                <span className={`text-sm ${totalRatio === 100 ? 'text-green-500' : 'text-yellow-500'}`}>
                  Total: {totalRatio}%
                </span>
              </div>

              {/* Visual bar */}
              <div className="flex h-4 rounded-full overflow-hidden mb-4">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${(config.shortRatio / Math.max(totalRatio, 1)) * 100}%` }}
                />
                <div
                  className="bg-yellow-500 transition-all"
                  style={{ width: `${(config.mediumRatio / Math.max(totalRatio, 1)) * 100}%` }}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${(config.longRatio / Math.max(totalRatio, 1)) * 100}%` }}
                />
              </div>

              {/* Individual sliders */}
              <div className="space-y-3">
                {ratioSettings.map((setting) => (
                  <div key={setting.key} className="flex items-center gap-3">
                    <span className={`w-20 text-sm font-medium ${setting.color}`}>{setting.label}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={config[setting.key] as number}
                      onChange={(e) => handleChange(setting.key, parseInt(e.target.value))}
                      className="flex-1 accent-accent"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config[setting.key] as number}
                      onChange={(e) => handleChange(setting.key, parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs text-secondary mt-3">
                Short: {config.minLength}-{config.shortMaxLength} chars |
                Medium: {config.shortMaxLength + 1}-{config.longMinLength - 1} chars |
                Long: {config.longMinLength}-{config.maxLength} chars
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Content Type Diversity Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Content Type Mix</h3>
          <button
            onClick={() => handleChange('typeDiversityEnabled', !config.typeDiversityEnabled)}
            className={`px-4 py-1 rounded-full text-sm font-medium transition-colors ${
              config.typeDiversityEnabled
                ? 'bg-accent text-white'
                : 'bg-secondary text-secondary'
            }`}
          >
            {config.typeDiversityEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {config.typeDiversityEnabled && (
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Target Type Mix</span>
              <span className={`text-sm ${
                (config.proseRatio + config.quoteRatio + config.poetryRatio + config.speechRatio) === 100
                  ? 'text-green-500'
                  : 'text-yellow-500'
              }`}>
                Total: {config.proseRatio + config.quoteRatio + config.poetryRatio + config.speechRatio}%
              </span>
            </div>

            {/* Visual bar */}
            <div className="flex h-4 rounded-full overflow-hidden mb-4">
              <div
                className="bg-indigo-500 transition-all"
                style={{ width: `${(config.proseRatio / Math.max(config.proseRatio + config.quoteRatio + config.poetryRatio + config.speechRatio, 1)) * 100}%` }}
                title="Prose"
              />
              <div
                className="bg-amber-500 transition-all"
                style={{ width: `${(config.quoteRatio / Math.max(config.proseRatio + config.quoteRatio + config.poetryRatio + config.speechRatio, 1)) * 100}%` }}
                title="Quotes"
              />
              <div
                className="bg-pink-500 transition-all"
                style={{ width: `${(config.poetryRatio / Math.max(config.proseRatio + config.quoteRatio + config.poetryRatio + config.speechRatio, 1)) * 100}%` }}
                title="Poetry"
              />
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(config.speechRatio / Math.max(config.proseRatio + config.quoteRatio + config.poetryRatio + config.speechRatio, 1)) * 100}%` }}
                title="Speech"
              />
            </div>

            {/* Individual sliders */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-indigo-500">Prose %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.proseRatio}
                  onChange={(e) => handleChange('proseRatio', parseInt(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.proseRatio}
                  onChange={(e) => handleChange('proseRatio', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-amber-500">Quote %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.quoteRatio}
                  onChange={(e) => handleChange('quoteRatio', parseInt(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.quoteRatio}
                  onChange={(e) => handleChange('quoteRatio', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-pink-500">Poetry %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.poetryRatio}
                  onChange={(e) => handleChange('poetryRatio', parseInt(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.poetryRatio}
                  onChange={(e) => handleChange('poetryRatio', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-emerald-500">Speech %</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.speechRatio}
                  onChange={(e) => handleChange('speechRatio', parseInt(e.target.value))}
                  className="flex-1 accent-accent"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.speechRatio}
                  onChange={(e) => handleChange('speechRatio', parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-secondary mt-3">
              Prose: novels, passages, sections | Quotes: quotes, sayings | Poetry: verses, poems | Speech: speeches
            </p>
          </div>
        )}
      </div>

      {/* Personalization Section */}
      <PersonalizationSection config={config} onChange={handleChange} />

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

interface PersonalizationSectionProps {
  config: FeedAlgorithmConfig;
  onChange: (key: keyof FeedAlgorithmConfig, value: number | boolean) => void;
}

function PersonalizationSection({ config, onChange }: PersonalizationSectionProps) {
  return (
    <div className="space-y-6">
      {/* Personalization Master Settings */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-accent" />
          <h3 className="font-bold text-lg">Personalization</h3>
        </div>

        <div className="space-y-4">
          {/* Master toggle */}
          <div className="bg-secondary/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Enable Personalization</div>
                <p className="text-sm text-secondary">Use user signals to customize feed</p>
              </div>
              <button
                onClick={() => onChange('enablePersonalization', !config.enablePersonalization)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  config.enablePersonalization
                    ? 'bg-accent text-white'
                    : 'bg-secondary text-secondary'
                }`}
              >
                {config.enablePersonalization ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          {config.enablePersonalization && (
            <>
              {/* Min signals threshold */}
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium">Min Signals Required</div>
                    <p className="text-sm text-secondary">Likes/bookmarks before enabling personalization</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={config.minSignalsForPersonalization}
                    onChange={(e) => onChange('minSignalsForPersonalization', parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-1 bg-primary border border-border rounded-lg text-right"
                  />
                </div>
              </div>

              {/* Full corpus toggle */}
              <div className="bg-secondary/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Full Corpus for Logged-in</div>
                    <p className="text-sm text-secondary">Access all works instead of curated only</p>
                  </div>
                  <button
                    onClick={() => onChange('fullCorpusForLoggedIn', !config.fullCorpusForLoggedIn)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      config.fullCorpusForLoggedIn
                        ? 'bg-accent text-white'
                        : 'bg-secondary text-secondary'
                    }`}
                  >
                    {config.fullCorpusForLoggedIn ? 'Yes' : 'No'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Signal Weights Section */}
      {config.enablePersonalization && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-lg">Signal Weights</h3>
          </div>

          {/* Account-required signals */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-secondary mb-3">Account Required</h4>
            <SignalWeightSlider
              label="Followed Author Boost"
              description="Boost for authors the user follows"
              value={config.followedAuthorBoost}
              onChange={(v) => onChange('followedAuthorBoost', v)}
              max={10}
              step={0.1}
              icon="star"
            />
          </div>

          {/* Device-based signals */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-secondary mb-3">Device-based (No account needed)</h4>
            <div className="space-y-3">
              <SignalWeightSlider
                label="Liked Author Boost"
                description="Boost for authors of passages user liked"
                value={config.likedAuthorBoost}
                onChange={(v) => onChange('likedAuthorBoost', v)}
                max={5}
                step={0.1}
                icon="heart"
              />
              <SignalWeightSlider
                label="Liked Category Boost"
                description="Boost for categories user prefers"
                value={config.likedCategoryBoost}
                onChange={(v) => onChange('likedCategoryBoost', v)}
                max={5}
                step={0.1}
                icon="folder"
              />
              <SignalWeightSlider
                label="Bookmarked Work Boost"
                description="Boost for works user bookmarked passages from"
                value={config.bookmarkedWorkBoost}
                onChange={(v) => onChange('bookmarkedWorkBoost', v)}
                max={5}
                step={0.1}
                icon="bookmark"
              />
              <SignalWeightSlider
                label="Bookmarked Author Boost"
                description="Boost for authors of bookmarked passages"
                value={config.bookmarkedAuthorBoost}
                onChange={(v) => onChange('bookmarkedAuthorBoost', v)}
                max={5}
                step={0.1}
                icon="user"
              />
            </div>
          </div>

          {/* Derived signals */}
          <div>
            <h4 className="text-sm font-medium text-secondary mb-3">Derived Signals</h4>
            <div className="space-y-3">
              <SignalWeightSlider
                label="Similar Era Boost"
                description="Boost for authors from similar time periods"
                value={config.similarEraBoost}
                onChange={(v) => onChange('similarEraBoost', v)}
                max={5}
                step={0.1}
                icon="clock"
              />
              <SignalWeightSlider
                label="Popularity Boost"
                description="Boost based on passage like count"
                value={config.popularityBoost}
                onChange={(v) => onChange('popularityBoost', v)}
                max={2}
                step={0.1}
                icon="trending"
              />
            </div>
          </div>
        </div>
      )}

      {/* Algorithm Tuning Section */}
      {config.enablePersonalization && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-lg">Algorithm Tuning</h3>
          </div>

          <div className="space-y-3">
            <TuningSlider
              label="Exploration (Random)"
              description="Weight for random discovery"
              value={config.baseRandomWeight}
              onChange={(v) => onChange('baseRandomWeight', v)}
            />
            <TuningSlider
              label="Exploitation (Personalized)"
              description="Weight for personalized content"
              value={config.personalizationWeight}
              onChange={(v) => onChange('personalizationWeight', v)}
            />
            <TuningSlider
              label="Recency Penalty"
              description="Penalty for recently shown content"
              value={config.recencyPenalty}
              onChange={(v) => onChange('recencyPenalty', v)}
            />
          </div>

          {/* Exploration vs Exploitation visualization */}
          <div className="bg-secondary/50 rounded-xl p-4 mt-4">
            <div className="text-sm text-secondary mb-2">Exploration vs Exploitation Balance</div>
            <div className="flex h-4 rounded-full overflow-hidden">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${config.baseRandomWeight * 100}%` }}
              />
              <div
                className="bg-accent transition-all"
                style={{ width: `${config.personalizationWeight * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-secondary">
              <span>Random: {(config.baseRandomWeight * 100).toFixed(0)}%</span>
              <span>Personal: {(config.personalizationWeight * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Embedding Settings Section */}
      {config.enablePersonalization && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-accent" />
            <h3 className="font-bold text-lg">Embedding Similarity</h3>
          </div>

          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="bg-secondary/50 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Enable Embedding Similarity</div>
                  <p className="text-sm text-secondary">Use taste vectors for personalization</p>
                </div>
                <button
                  onClick={() => onChange('enableEmbeddingSimilarity', !config.enableEmbeddingSimilarity)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    config.enableEmbeddingSimilarity
                      ? 'bg-accent text-white'
                      : 'bg-secondary text-secondary'
                  }`}
                >
                  {config.enableEmbeddingSimilarity ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {config.enableEmbeddingSimilarity && (
              <>
                <TuningSlider
                  label="Embedding Similarity Weight"
                  description="Weight for embedding-based matching"
                  value={config.embeddingSimilarityWeight}
                  onChange={(v) => onChange('embeddingSimilarityWeight', v)}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-secondary/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Min Likes for Taste Vector</div>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={config.minLikesForTasteVector}
                        onChange={(e) => onChange('minLikesForTasteVector', parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                      />
                    </div>
                    <p className="text-xs text-secondary">Likes needed to compute taste</p>
                  </div>

                  <div className="bg-secondary/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Refresh Hours</div>
                      <input
                        type="number"
                        min={0.5}
                        max={168}
                        step={0.5}
                        value={config.tasteVectorRefreshHours}
                        onChange={(e) => onChange('tasteVectorRefreshHours', parseFloat(e.target.value) || 1)}
                        className="w-16 px-2 py-1 bg-primary border border-border rounded-lg text-right text-sm"
                      />
                    </div>
                    <p className="text-xs text-secondary">How often to recompute taste</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface SignalWeightSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  max: number;
  step: number;
  icon: 'star' | 'heart' | 'folder' | 'bookmark' | 'user' | 'clock' | 'trending';
}

function SignalWeightSlider({ label, description, value, onChange, max, step }: SignalWeightSliderProps) {
  return (
    <div className="bg-secondary/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium text-sm">{label}</div>
          <p className="text-xs text-secondary">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono w-12 text-right">{value.toFixed(1)}x</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
      <div className="flex justify-between text-xs text-secondary mt-1">
        <span>0x</span>
        <span>{max}x</span>
      </div>
    </div>
  );
}

interface TuningSliderProps {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

function TuningSlider({ label, description, value, onChange }: TuningSliderProps) {
  return (
    <div className="bg-secondary/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="font-medium text-sm">{label}</div>
          <p className="text-xs text-secondary">{description}</p>
        </div>
        <span className="text-sm font-mono">{(value * 100).toFixed(0)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

function UsersTab({ stats }: { stats: Phase2Stats }) {
  return (
    <div className="space-y-6">
      {/* User stats */}
      <div>
        <h3 className="font-bold mb-3">Users</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary rounded-xl p-4">
            <div className="text-2xl font-bold">{stats.users.total.toLocaleString()}</div>
            <div className="text-sm text-secondary">Total Users</div>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <div className="text-2xl font-bold">{stats.users.activeThisWeek.toLocaleString()}</div>
            <div className="text-sm text-secondary">Active This Week</div>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <div className="text-2xl font-bold">{stats.users.withLikes.toLocaleString()}</div>
            <div className="text-sm text-secondary">Users with Likes</div>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <div className="text-2xl font-bold">{stats.users.withFollows.toLocaleString()}</div>
            <div className="text-sm text-secondary">Users Following</div>
          </div>
        </div>
      </div>

      {/* Embeddings progress */}
      <div>
        <h3 className="font-bold mb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          Embeddings
        </h3>
        <div className="bg-secondary rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-secondary">Processing Progress</span>
            <span className="font-bold">{stats.embeddings.percentComplete}%</span>
          </div>
          <div className="h-3 bg-primary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${stats.embeddings.percentComplete}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-sm text-secondary">
            <span>{stats.embeddings.withEmbeddings.toLocaleString()} processed</span>
            <span>{stats.embeddings.total.toLocaleString()} total</span>
          </div>
        </div>
      </div>

      {/* Lists */}
      <div>
        <h3 className="font-bold mb-3">Lists</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-secondary rounded-xl p-4 text-center">
            <div className="text-xl font-bold">{stats.lists.total}</div>
            <div className="text-xs text-secondary">Total Lists</div>
          </div>
          <div className="bg-secondary rounded-xl p-4 text-center">
            <div className="text-xl font-bold">{stats.lists.curated}</div>
            <div className="text-xs text-secondary">Curated</div>
          </div>
          <div className="bg-secondary rounded-xl p-4 text-center">
            <div className="text-xl font-bold">{stats.lists.totalPassagesInLists}</div>
            <div className="text-xs text-secondary">Passages Saved</div>
          </div>
        </div>
      </div>

      {/* Top followed authors */}
      <div>
        <h3 className="font-bold mb-3">Most Followed Authors</h3>
        {stats.follows.topAuthors.length === 0 ? (
          <p className="text-secondary">No follows yet</p>
        ) : (
          <div className="space-y-2">
            {stats.follows.topAuthors.map((author, i) => (
              <div
                key={author.slug}
                className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-secondary">#{i + 1}</span>
                  <span>{author.name}</span>
                </div>
                <span className="text-accent font-medium">{author.followers} followers</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 text-sm text-secondary">
          Total follows: {stats.follows.totalFollows.toLocaleString()}
        </div>
      </div>
    </div>
  );
}
