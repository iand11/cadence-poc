import Anthropic from '@anthropic-ai/sdk';

const PROGRESS_STEPS = [
  { step: 0, text: 'Analyzing streaming metrics' },
  { step: 1, text: 'Profiling audience demographics' },
  { step: 2, text: 'Evaluating platform performance' },
  { step: 3, text: 'Optimizing budget allocation' },
  { step: 4, text: 'Generating creative strategy' },
];

// Character thresholds to trigger each progress step
const THRESHOLDS = [0, 900, 1800, 3000, 4200];

function sendEvent(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // Flush immediately so the client receives the event without buffering
  if (typeof res.flush === 'function') res.flush();
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { artistData, budget, goal = 'growth' } = req.body || {};

  if (!artistData || !budget) {
    return res.status(400).json({ error: 'artistData and budget are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  // SSE headers — writeHead sends immediately to prevent buffering
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a senior music marketing strategist with 10+ years experience. You analyze artist profiles deeply and create comprehensive marketing strategies.

Analyze the artist's current position, platform strengths/weaknesses, audience gaps, and market opportunity. Then recommend a detailed, data-driven marketing plan.

You must respond with ONLY a valid JSON object (no markdown, no backticks). The JSON must match this exact schema:
{
  "artistAnalysis": {
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "opportunities": ["opportunity1", "opportunity2"],
    "threats": ["threat1", "threat2"],
    "coreAudience": "description of primary audience demographic and psychographic",
    "audienceGaps": ["gap1", "gap2"],
    "platformRanking": {
      "strongest": "platform name and why",
      "weakest": "platform name and why",
      "untapped": "platform with growth potential"
    }
  },
  "recommendation": {
    "strategicApproach": "One sentence describing the overall strategy",
    "rationale": "3-4 sentences explaining why this approach based on artist metrics",
    "allocation": {
      "spotify": <0-100>,
      "meta": <0-100>,
      "google": <0-100>,
      "youtube": <0-100>,
      "tiktok": <0-100>,
      "x": <0-100>
    },
    "tactics": {
      "spotify": ["tactic1", "tactic2"],
      "meta": ["tactic1", "tactic2"],
      "google": ["tactic1", "tactic2"],
      "youtube": ["tactic1", "tactic2"],
      "tiktok": ["tactic1", "tactic2"],
      "x": ["tactic1", "tactic2"]
    },
    "messaging": "Core message/positioning for this campaign",
    "creativeGuidance": "Description of creative approach (tone, format, themes)"
  },
  "variants": [
    {
      "name": "Aggressive Growth",
      "description": "High-risk, high-reward allocation",
      "allocation": { "spotify": 0, "meta": 0, "google": 0, "youtube": 0, "tiktok": 0, "x": 0 },
      "expectedOutcome": "Description of likely outcome and best-case ROI"
    },
    {
      "name": "Conservative",
      "description": "Low-risk, steady-growth allocation",
      "allocation": { "spotify": 0, "meta": 0, "google": 0, "youtube": 0, "tiktok": 0, "x": 0 },
      "expectedOutcome": "Description of likely outcome and best-case ROI"
    }
  ],
  "riskAssessment": {
    "primary": "Primary risk and mitigation",
    "secondary": "Secondary risk and mitigation",
    "marketCondition": "Current market condition assessment and relevance"
  },
  "timeline": {
    "phase1": { "duration": "X weeks", "focus": "what to focus on", "budget_pct": 30 },
    "phase2": { "duration": "X weeks", "focus": "what to focus on", "budget_pct": 50 },
    "phase3": { "duration": "X weeks", "focus": "what to focus on", "budget_pct": 20 }
  },
  "successMetrics": {
    "primary": "Main KPI to track",
    "secondary": ["metric1", "metric2"],
    "threshold": "Success criteria (e.g., 50K streams, 10K followers)"
  },
  "collaborationLeverage": "How to leverage artist collaborators for mutual benefit",
  "contentStrategy": "Recommended content themes and release strategy",
  "competitiveIntelligence": "What similar artists are doing and competitive advantages"
}

Rules:
- Provide deep, nuanced analysis not surface-level recommendations
- Reference actual artist metrics in your rationale
- All 6 platform percentages (spotify, meta, google, youtube, tiktok, x) must sum to 100
- "google" is for Google Search ads; "youtube" is for YouTube Video ads — allocate them separately
- Variants should be meaningfully different (not just 5% shifts)
- Be specific about platform tactics - not generic advice
- Consider artist's existing strengths and how to leverage them
- Identify real gaps and how to fill them
- Think about creative execution, not just budget
- Consider seasonality and cultural moments relevant to the artist
- Address ROI and business impact`;

  try {
    const prompt = `Conduct a comprehensive marketing analysis and create a strategic plan for this artist.

ARTIST PROFILE:
Name: ${artistData.name || 'Unknown'}
Genre: ${artistData.genres?.primary?.name || 'Unknown'}
Artist Type: ${artistData.artistType || 'person'}
Is Active: ${artistData.isActive !== false ? 'Yes' : 'No'}
Label: ${artistData.label || 'Independent'}

STREAMING & SOCIAL METRICS:
Spotify:
  - Monthly Listeners: ${(artistData.spotify?.monthlyListeners || 0).toLocaleString()}
  - Followers: ${(artistData.spotify?.followers || 0).toLocaleString()}
  - Popularity Score: ${artistData.spotify?.popularity || 0}/100
  - Playlists: ${artistData.spotify?.playlists?.total || 0} total (${artistData.spotify?.playlists?.editorial || 0} editorial)
  - Playlist Reach: ${(artistData.spotify?.playlists?.reach || 0).toLocaleString()} impressions

Social Media:
  - Instagram: ${(artistData.social?.instagram || 0).toLocaleString()} followers (Rank #${artistData.social?.instagramRank || 'N/A'})
  - YouTube: ${(artistData.social?.youtube || 0).toLocaleString()} subscribers (Rank #${artistData.social?.youtubeRank || 'N/A'})
  - TikTok: ${(artistData.social?.tiktok || 0).toLocaleString()} followers (Rank #${artistData.social?.tiktokRank || 'N/A'})
  - X (Twitter): ${(artistData.social?.twitter || 0).toLocaleString()} followers

TOP TRACKS:
${artistData.tracks?.slice(0, 5).map((t, i) =>
  `${i + 1}. "${t.name}" - ${(t.streams || 0).toLocaleString()} streams, Popularity: ${t.popularity}/100${t.isFeature ? ' (Feature)' : ''}`
).join('\n') || 'No track data'}

COLLABORATIONS:
${artistData.collaborators?.slice(0, 10).map(c => `- ${c.name}`).join('\n') || 'No collaborators'}

CAMPAIGN GOAL: ${goal}
TOTAL BUDGET: $${budget}

Provide comprehensive strategic analysis and multiple allocation options.`;

    // Send initial progress
    sendEvent(res, { type: 'progress', ...PROGRESS_STEPS[0] });

    // Stream the Claude response
    const stream = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    let text = '';
    let currentStep = 0;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text;

        // Check if we should advance to the next progress step
        const nextStep = currentStep + 1;
        if (nextStep < THRESHOLDS.length && text.length >= THRESHOLDS[nextStep]) {
          currentStep = nextStep;
          sendEvent(res, { type: 'progress', ...PROGRESS_STEPS[nextStep] });
        }
      }
    }

    // Final processing step
    sendEvent(res, { type: 'progress', step: 5, text: 'Building campaign plan' });

    // Parse and process the response
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const analysis = JSON.parse(text);

    // Calculate dollar allocation for primary recommendation
    const allocation = {
      spotify: Math.round((analysis.recommendation.allocation.spotify / 100) * budget),
      meta: Math.round((analysis.recommendation.allocation.meta / 100) * budget),
      google: Math.round((analysis.recommendation.allocation.google / 100) * budget),
      youtube: Math.round(((analysis.recommendation.allocation.youtube || 0) / 100) * budget),
      tiktok: Math.round((analysis.recommendation.allocation.tiktok / 100) * budget),
      x: Math.round((analysis.recommendation.allocation.x / 100) * budget),
    };

    // Platform benchmarks
    const benchmarks = {
      spotify: { cpm: 3.0, ctr: 0.015, cpr: 1.21, unit: 'streams' },
      meta: { cpm: 5.5, ctr: 0.012, cpr: 7.99, unit: 'followers' },
      google: { cpm: 8.0, ctr: 0.008, cpr: 4.45, unit: 'clicks' },
      youtube: { cpm: 6.0, ctr: 0.010, cpr: 3.50, unit: 'video views' },
      tiktok: { cpm: 4.2, ctr: 0.022, cpr: 1.27, unit: 'followers' },
      x: { cpm: 6.5, ctr: 0.008, cpr: 5.50, unit: 'followers' },
    };

    // Calculate expected metrics
    const expectedMetrics = {};
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalResults = 0;

    Object.entries(allocation).forEach(([platform, amount]) => {
      const bench = benchmarks[platform];
      const impressions = Math.round((amount / bench.cpm) * 1000);
      const clicks = Math.round(impressions * bench.ctr);
      const results = Math.round(amount / bench.cpr);

      expectedMetrics[platform] = {
        budget: amount,
        impressions,
        clicks,
        results,
        unit: bench.unit,
        cpr: bench.cpr.toFixed(2),
      };

      totalImpressions += impressions;
      totalClicks += clicks;
      totalResults += results;
    });

    const totals = {
      budget,
      impressions: totalImpressions,
      clicks: totalClicks,
      results: totalResults,
      cpr: (budget / totalResults).toFixed(2),
    };

    // Process variants with budget calculations
    const variantsWithMetrics = analysis.variants.map((variant) => {
      const variantAllocation = {
        spotify: Math.round((variant.allocation.spotify / 100) * budget),
        meta: Math.round((variant.allocation.meta / 100) * budget),
        google: Math.round((variant.allocation.google / 100) * budget),
        youtube: Math.round(((variant.allocation.youtube || 0) / 100) * budget),
        tiktok: Math.round((variant.allocation.tiktok / 100) * budget),
        x: Math.round((variant.allocation.x / 100) * budget),
      };

      let variantImpressions = 0;
      let variantResults = 0;

      Object.entries(variantAllocation).forEach(([platform, amount]) => {
        const bench = benchmarks[platform];
        const impressions = Math.round((amount / bench.cpm) * 1000);
        const results = Math.round(amount / bench.cpr);
        variantImpressions += impressions;
        variantResults += results;
      });

      return {
        ...variant,
        allocation: variantAllocation,
        expectedImpressions: variantImpressions,
        expectedResults: variantResults,
        expectedCPR: (budget / variantResults).toFixed(2),
      };
    });

    sendEvent(res, {
      type: 'result',
      data: {
        artistAnalysis: analysis.artistAnalysis,
        recommendation: {
          ...analysis.recommendation,
          allocation,
        },
        variants: variantsWithMetrics,
        expectedMetrics,
        totals,
        riskAssessment: analysis.riskAssessment,
        timeline: analysis.timeline,
        successMetrics: analysis.successMetrics,
        collaborationLeverage: analysis.collaborationLeverage,
        contentStrategy: analysis.contentStrategy,
        competitiveIntelligence: analysis.competitiveIntelligence,
        goal,
      },
    });
    res.end();
  } catch (error) {
    console.error('Advanced marketing plan error:', error);
    sendEvent(res, { type: 'error', message: error.message });
    res.end();
  }
}

export default handler;

export const config = {
  maxDuration: 60,
};
