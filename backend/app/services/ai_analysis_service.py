import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import google.generativeai as genai

from app.core.config import settings
from app.schemas.incident import IncidentAnalysisResponse

logger = logging.getLogger(__name__)


class AIAnalysisService:
    def __init__(self):
        self._gemini_model = None
        self._initialized = False

    def _initialize(self):
        if self._initialized:
            return

        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self._gemini_model = genai.GenerativeModel(settings.GEMINI_MODEL)
            self._initialized = True
        else:
            raise ValueError("GEMINI_API_KEY not configured. Get one at https://aistudio.google.com/apikey")

    async def analyze_incident(
        self,
        incident_id: str,
        incident_title: str,
        incident_description: str,
        severity: str,
        k8s_context: Optional[Dict[str, Any]] = None,
        jenkins_context: Optional[Dict[str, Any]] = None,
        timeline_events: Optional[List[Dict[str, Any]]] = None,
        additional_context: Optional[str] = None,
    ) -> IncidentAnalysisResponse:
        self._initialize()

        context_parts = []

        context_parts.append(
            f"""
## Incident Details
- **ID**: {incident_id}
- **Title**: {incident_title}
- **Severity**: {severity}
- **Description**: {incident_description or 'No description provided'}
"""
        )

        if k8s_context:
            context_parts.append(
                f"""
## Kubernetes Context
- **Namespace**: {k8s_context.get('namespace', 'N/A')}
- **Affected Pods**: {json.dumps(k8s_context.get('pods', []), indent=2)}
- **Recent Events**: {json.dumps(k8s_context.get('events', [])[:10], indent=2)}
- **Deployment Status**: {json.dumps(k8s_context.get('deployments', []), indent=2)}
"""
            )

        if jenkins_context:
            context_parts.append(
                f"""
## Jenkins Context
- **Recent Builds**: {json.dumps(jenkins_context.get('recent_builds', []), indent=2)}
- **Failed Jobs**: {json.dumps(jenkins_context.get('failed_jobs', []), indent=2)}
"""
            )

        if timeline_events:
            context_parts.append(
                f"""
## Recent Timeline Events (Last 24 hours)
{json.dumps(timeline_events[:20], indent=2)}
"""
            )

        if additional_context:
            context_parts.append(
                f"""
## Additional Context
{additional_context}
"""
            )

        full_context = "\n".join(context_parts)

        prompt = f"""You are an expert Site Reliability Engineer (SRE) and DevOps incident analyst.
Your role is to analyze incidents, identify root causes, and provide actionable recommendations.

When analyzing incidents:
1. Look for patterns in the provided context (K8s events, deployments, builds)
2. Identify potential root causes based on the timeline of events
3. Consider common failure modes (OOM, network issues, configuration drift, bad deployments)
4. Provide specific, actionable recommendations
5. Assess confidence in your analysis based on available data

Please analyze the following incident:

{full_context}

Provide your analysis in the following JSON format. Return ONLY valid JSON, no markdown code blocks:
{{
    "analysis": "Detailed analysis of the incident...",
    "root_cause_hypothesis": "Most likely root cause...",
    "recommendations": ["Recommendation 1", "Recommendation 2"],
    "related_events": [{{"event": "event description", "relevance": "why it's relevant"}}],
    "confidence_score": 0.75
}}"""

        try:
            response = self._gemini_model.generate_content(prompt)
            response_text = response.text

            # Parse JSON from response
            try:
                # Clean up response - remove markdown code blocks if present
                cleaned = response_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]

                analysis_data = json.loads(cleaned.strip())
            except json.JSONDecodeError:
                analysis_data = {
                    "analysis": response_text,
                    "root_cause_hypothesis": None,
                    "recommendations": [],
                    "related_events": [],
                    "confidence_score": 0.5,
                }

            return IncidentAnalysisResponse(
                incident_id=incident_id,
                analysis=analysis_data.get("analysis", response_text),
                root_cause_hypothesis=analysis_data.get("root_cause_hypothesis"),
                recommendations=analysis_data.get("recommendations", []),
                related_events=analysis_data.get("related_events", []),
                confidence_score=analysis_data.get("confidence_score", 0.5),
            )

        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            return IncidentAnalysisResponse(
                incident_id=incident_id,
                analysis=f"AI analysis error: {str(e)}",
                root_cause_hypothesis=None,
                recommendations=["Manual investigation required"],
                related_events=[],
                confidence_score=0.0,
            )

    async def suggest_runbook(
        self, incident_type: str, symptoms: List[str], affected_services: List[str]
    ) -> Dict[str, Any]:
        self._initialize()

        prompt = f"""Based on the following incident characteristics, suggest a troubleshooting runbook:

Incident Type: {incident_type}
Symptoms: {', '.join(symptoms)}
Affected Services: {', '.join(affected_services)}

Provide a step-by-step runbook in JSON format. Return ONLY valid JSON, no markdown:
{{
    "title": "Runbook title",
    "steps": [
        {{"step": 1, "action": "...", "expected_outcome": "...", "commands": ["..."]}}
    ],
    "escalation_criteria": ["..."],
    "recovery_validation": ["..."]
}}"""

        try:
            response = self._gemini_model.generate_content(prompt)
            response_text = response.text

            try:
                cleaned = response_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                return json.loads(cleaned.strip())
            except json.JSONDecodeError:
                return {"raw_response": response_text}

        except Exception as e:
            logger.error(f"Runbook suggestion failed: {e}")
            return {"error": str(e)}

    async def correlate_events(
        self, incident_timestamp: datetime, events: List[Dict[str, Any]], window_minutes: int = 30
    ) -> Dict[str, Any]:
        self._initialize()

        window_start = incident_timestamp - timedelta(minutes=window_minutes)
        window_end = incident_timestamp + timedelta(minutes=5)

        relevant_events = []
        for e in events:
            try:
                event_time = datetime.fromisoformat(e.get("timestamp", ""))
                if window_start <= event_time <= window_end:
                    relevant_events.append(e)
            except (ValueError, TypeError):
                continue

        if not relevant_events:
            return {"correlations": [], "potential_triggers": [], "confidence": 0.0}

        prompt = f"""Analyze these events that occurred around an incident at {incident_timestamp.isoformat()}:

Events:
{json.dumps(relevant_events, indent=2)}

Identify:
1. Events that may have triggered the incident
2. Correlations between events
3. Patterns that suggest root cause

Return as JSON. Return ONLY valid JSON, no markdown:
{{
    "correlations": [{{"event_a": "...", "event_b": "...", "relationship": "..."}}],
    "potential_triggers": [{{"event": "...", "likelihood": 0.8, "reasoning": "..."}}],
    "patterns": ["..."],
    "confidence": 0.75
}}"""

        try:
            response = self._gemini_model.generate_content(prompt)
            response_text = response.text

            try:
                cleaned = response_text.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                return json.loads(cleaned.strip())
            except json.JSONDecodeError:
                return {"raw_response": response_text}

        except Exception as e:
            logger.error(f"Event correlation failed: {e}")
            return {"error": str(e)}


ai_analysis_service = AIAnalysisService()
