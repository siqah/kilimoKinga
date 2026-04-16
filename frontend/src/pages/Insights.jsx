import { useState, useEffect } from 'react';
import axios from 'axios';

const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];
const BACKEND_URL = 'http://localhost:3001';

export default function Insights() {
  const [region, setRegion] = useState(REGIONS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      setError(null);
      try {
        const [fcRes, riskRes, recRes, yieldRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/forecast/${region}?days=7`),
          axios.get(`${BACKEND_URL}/api/risk/${region}`),
          axios.get(`${BACKEND_URL}/api/recommend/${region}`),
          axios.get(`${BACKEND_URL}/api/yield/${region}?crop=${selectedCrop}`)
        ]);

        setData({
          forecast: fcRes.data,
          risk: riskRes.data,
          recommendations: recRes.data,
          yieldPred: yieldRes.data,
        });
      } catch (err) {
        console.error('Failed to fetch insights', err);
        setError('Unable to fetch insight data. Please ensure the AI microservices and oracle backend are online.');
      } finally {
        setLoading(false);
      }
    }
    fetchInsights();
  }, [region, selectedCrop]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
          🧠 Farm AI Insights
        </h2>
        <select 
          value={region} 
          onChange={(e) => setRegion(e.target.value)}
          className="bg-black/40 backdrop-blur-md border border-white/10 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none transition-all cursor-pointer hover:bg-black/60"
        >
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-xl p-8 text-center text-red-400 flex flex-col items-center justify-center gap-4">
          <span className="text-4xl drop-shadow-md">⚠️</span>
          <h3 className="text-lg font-semibold text-white">Connection Error</h3>
          <p className="max-w-md">{error}</p>
          <button 
            onClick={() => {
              setRegion(r => r === 'Laikipia' ? 'Nakuru' : 'Laikipia'); // Quick hack to trigger re-fetch safely
              setTimeout(() => setRegion(region), 50);
            }} 
            className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors border border-red-500/30"
          >
            Retry Connection
          </button>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-emerald-400/70">
          <div className="w-12 h-12 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
          <p className="animate-pulse font-medium">Analyzing satellite and weather data...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* Top row: Risk & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Risk Score Card */}
            <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl hover:bg-black/30 transition-all duration-300">
              <h3 className="text-lg font-semibold text-white/90 mb-6 flex items-center gap-2">
                <span className="text-xl">⚠️</span> Coverage Risk Level
              </h3>
              {data.risk ? (
                <div className="flex flex-col items-center justify-center h-full pb-8">
                  <div className={`text-7xl font-black mb-4 ${data.risk.level === 'low' ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' : data.risk.level === 'moderate' ? 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]'}`}>
                    {data.risk.score}
                    <span className="text-2xl text-white/30 font-normal">/100</span>
                  </div>
                  <div className={`px-5 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider border ${data.risk.level === 'low' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : data.risk.level === 'moderate' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                    {data.risk.level} Risk
                  </div>
                  <p className="mt-6 text-white/50 text-sm text-center max-w-xs leading-relaxed">
                    Based on drought severity, heat indices, vegetation layers, and historical trends.
                  </p>
                </div>
              ) : (
                <div className="text-white/40 text-center py-10 font-medium">No risk data available for this region.</div>
              )}
            </div>

            {/* Recommendations Card */}
            <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl hover:bg-black/30 transition-all duration-300 flex flex-col">
              <h3 className="text-lg font-semibold text-white/90 mb-6 flex items-center gap-2">
                <span className="text-xl">🌱</span> Optimal Crops for {region}
              </h3>
              {data.recommendations ? (
                <div className="flex-1 flex flex-col">
                  {data.recommendations.recommendations && data.recommendations.recommendations.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {data.recommendations.recommendations.map((rec, i) => (
                        <div key={i} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-4 py-1.5 rounded-full text-sm font-medium">
                          {rec.crop}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-white/40 mb-6 font-medium">No specific crop recommendations found.</div>
                  )}
                  
                  <div className="text-sm text-white/60 mb-6 bg-white/5 border border-white/10 rounded-xl p-4 inline-flex flex-col gap-2 self-start">
                    <div className="flex items-center gap-2"><strong className="text-white/80">Soil Type:</strong> <span className="capitalize">{data.recommendations.soil?.replace('_', ' ') || 'Unknown'}</span></div>
                    <div className="flex items-center gap-2"><strong className="text-white/80">Altitude:</strong> <span>{data.recommendations.altitude || '--'}m</span></div>
                  </div>
                  
                  {/* Yield Prediction */}
                  <div className="mt-auto pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center mb-5">
                      <h4 className="font-bold text-white/80 text-xs uppercase tracking-wider">Yield Prediction</h4>
                      <select 
                        value={selectedCrop} 
                        onChange={e => setSelectedCrop(e.target.value)} 
                        className="bg-black/50 border border-white/10 text-white rounded-lg px-3 py-1.5 text-sm outline-none cursor-pointer focus:border-cyan-500/50 hover:bg-black/70 transition-colors"
                      >
                        {data.recommendations.recommendations?.map(r => <option key={r.crop} value={r.crop}>{r.crop}</option>)}
                      </select>
                    </div>
                    {data.yieldPred ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 rounded-xl p-5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
                          <div className="text-xs text-white/50 mb-1.5 uppercase tracking-wider font-semibold">Est. Harvest</div>
                          <div className="text-2xl font-bold text-white">{data.yieldPred.predictedYield} <span className="text-sm font-medium text-white/50">kg/ha</span></div>
                        </div>
                        <div className="bg-white/5 rounded-xl p-5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
                          <div className="text-xs text-white/50 mb-1.5 uppercase tracking-wider font-semibold">Vs Baseline</div>
                          <div className={`text-2xl font-bold ${data.yieldPred.yieldPercent >= 100 ? 'text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]'}`}>
                            {data.yieldPred.yieldPercent}%
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-white/40 text-sm font-medium pt-2 block">Select a available crop to view yield estimates.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-white/40 text-center py-10 font-medium">No recommendation data available.</div>
              )}
            </div>
          </div>

          {/* 7-Day Forecast */}
          <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl hover:bg-black/30 transition-all duration-300">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <h3 className="text-lg font-semibold text-white/90 flex items-center gap-2">
                <span className="text-xl">🌦️</span> 7-Day Microclimate Matrix
              </h3>
              {data.forecast?.alerts?.length > 0 && (
                <div className="bg-rose-500/20 text-rose-400 px-4 py-1.5 rounded-full text-sm font-bold border border-rose-500/30 animate-pulse tracking-wide">
                  {data.forecast.alerts.length} Active Alert{data.forecast.alerts.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            
            {data.forecast?.alerts?.length > 0 && (
              <div className="bg-rose-500/10 border-l-4 border-rose-500 p-5 rounded-r-xl mb-6 text-rose-300 text-sm shadow-inner shadow-rose-900/20">
                <ul className="list-disc pl-5 space-y-1.5 font-medium">
                  {data.forecast.alerts.map((a, idx) => (
                    <li key={idx} className="leading-snug">{a.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.forecast?.forecast?.length > 0 ? (
              <div className="flex overflow-x-auto gap-4 pb-4 snap-x no-scrollbar">
                {data.forecast.forecast.map(day => (
                  <div key={day.day} className="flex-shrink-0 w-32 bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center snap-center hover:bg-white/10 hover:border-white/20 transition-all cursor-default">
                    <div className="text-xs text-white/40 font-bold uppercase tracking-widest mb-4">Day {day.day}</div>
                    <div className="text-5xl mb-4 filter drop-shadow-lg">
                      {day.condition === 'rainy' ? '🌧️' : day.condition === 'dry' ? '☀️' : day.condition === 'hot_dry' ? '🔥' : '⛅'}
                    </div>
                    <div className="text-xl font-bold text-white mb-1.5">{day.temperature}°C</div>
                    <div className="text-sm text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">{day.rainfall.toFixed(1)} mm</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/40 text-center py-12 font-medium">No weather matrix data available for {region}.</div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
