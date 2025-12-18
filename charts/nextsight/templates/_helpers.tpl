{{/*
Expand the name of the chart.
*/}}
{{- define "nextsight.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "nextsight.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "nextsight.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "nextsight.labels" -}}
helm.sh/chart: {{ include "nextsight.chart" . }}
{{ include "nextsight.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "nextsight.selectorLabels" -}}
app.kubernetes.io/name: {{ include "nextsight.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "nextsight.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "nextsight.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend image tag
*/}}
{{- define "nextsight.backendTag" -}}
{{- .Values.backend.image.tag | default .Values.global.imageTag | default .Chart.AppVersion }}
{{- end }}

{{/*
Frontend image tag
*/}}
{{- define "nextsight.frontendTag" -}}
{{- .Values.frontend.image.tag | default .Values.global.imageTag | default .Chart.AppVersion }}
{{- end }}
