import { useState, useEffect } from 'react';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];
const BACKEND_URL = 'http://localhost:3001';

export default function Insights() {
  const [region, setRegion] = useState(REGIONS[0]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    forecast: null,
    risk: null,
    recommendations: null,
    yieldPred: null,
  });
  const [selectedCrop, setSelectedCrop] = useState('maize');

  useEffect(() => {
    async function fetchInsights() {
      setLoading(true);
      try {
        const [fcRes, riskRes, recRes, yieldRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/forecast/${region}?days=7`),
          fetch(`${BACKEND_URL}/api/risk/${region}`),
          fetch(`${BACKEND_URL}/api/recommend/${region}`),
          fetch(`${BACKEND_URL}/api/yield/${region}?crop=${selectedCrop}`)
        ]);

        setData({
          forecast: await fcRes.json(),
          risk: await riskRes.json(),
          recommendations: await recRes.json(),
          yieldPred: await yieldRes.json(),
        });
      } catch (err) {
        console.error('Failed to fetch insights', err);
      }
      setLoading(false);
    }
    fetchInsights();
  }, [region, selectedCrop]);

  return (
    <>
      <div className="section-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🧠 Farm AI Insights</span>
        <select 
          value={region} 
          onChange={(e) => setRegion(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}
        >
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <span className="spinner" style={{ width: '2rem', height: '2rem', borderWidth: '3px' }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Analyzing satellite and weather data...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Top row: Risk & Recommendations */}
          <div className="two-col">
            {/* Risk Score */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>⚠️ Coverage Risk Level</h3>
              {data.risk && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '4rem', 
                    fontWeight: 800, 
                    color: data.risk.level === 'low' ? 'var(--accent-green)' : data.risk.level === 'moderate' ? 'var(--accent-amber)' : 'var(--accent-red)' 
                  }}>
                    {data.risk.score}
                    <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)' }}>/100</span>
                  </div>
                  <div className={`badge badge-${data.risk.level === 'low' ? 'success' : 'warning'}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem', marginTop: '0.5rem' }}>
                    {data.risk.level.toUpperCase()}
                  </div>
                  <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Based on drought, heat, vegetation layers, and historical trends.
                  </p>
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>🌱 Optimal Crops for {region}</h3>
              {data.recommendations && (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                    {data.recommendations.recommendations.map((rec, i) => (
                      <div key={i} className="badge" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                        {rec.crop}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <div><strong>Soil type:</strong> {data.recommendations.soil.replace('_', ' ')}</div>
                    <div><strong>Altitude:</strong> {data.recommendations.altitude}m</div>
                  </div>
                  
                  {/* Yield Prediction */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0 }}>Yield Prediction</h4>
                      <select value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)} style={{ padding: '0.25rem' }}>
                        {data.recommendations.recommendations.map(r => <option key={r.crop} value={r.crop}>{r.crop}</option>)}
                      </select>
                    </div>
                    {data.yieldPred && (
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ flex: 1, background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Estimated Harvest</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{data.yieldPred.predictedYield} kg/ha</div>
                        </div>
                        <div style={{ flex: 1, background: 'var(--bg-glass)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs Baseline</div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: data.yieldPred.yieldPercent >= 100 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
                            {data.yieldPred.yieldPercent}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Forecast */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>🌦️ 7-Day Microclimate Forecast</h3>
              {data.forecast && data.forecast.alerts.length > 0 && (
                <div className="badge badge-warning">
                  {data.forecast.alerts.length} Alert{data.forecast.alerts.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            
            {data.forecast && data.forecast.alerts.length > 0 && (
              <div style={{ background: 'var(--accent-red-dim)', color: 'var(--accent-red)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                {data.forecast.alerts.map(a => a.message).join(' | ')}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {data.forecast && data.forecast.forecast.map(day => (
                <div key={day.day} style={{ 
                  background: 'var(--bg-glass)', 
                  padding: '1rem 0.5rem', 
                  borderRadius: 'var(--radius-sm)', 
                  textAlign: 'center',
                  minWidth: '80px'
                }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Day {day.day}</div>
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                    {day.condition === 'rainy' ? '🌧️' : day.condition === 'dry' ? '☀️' : day.condition === 'hot_dry' ? '🔥' : '⛅'}
                  </div>
                  <div style={{ fontWeight: 600 }}>{day.temperature}°C</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)' }}>{day.rainfall.toFixed(1)} mm</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </>
  );
}
