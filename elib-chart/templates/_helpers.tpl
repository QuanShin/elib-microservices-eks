{{- define "elib-chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "elib-chart.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s" (include "elib-chart.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "elib-chart.namespace" -}}
{{- if .Values.namespaceOverride -}}
{{- .Values.namespaceOverride -}}
{{- else -}}
{{- .Release.Namespace -}}
{{- end -}}
{{- end -}}

{{- define "elib-chart.componentFullname" -}}
{{- printf "%s-%s" (include "elib-chart.fullname" .root) .name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "elib-chart.componentLabels" -}}
app.kubernetes.io/name: {{ include "elib-chart.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .name }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "elib-chart.componentSelectorLabels" -}}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .name }}
{{- end -}}

{{- define "elib-chart.serviceAccountName" -}}
{{- if .serviceAccount.create -}}
{{- if .serviceAccount.name -}}
{{- .serviceAccount.name -}}
{{- else -}}
{{- printf "%s-sa" (include "elib-chart.componentFullname" (dict "root" .root "name" .name)) -}}
{{- end -}}
{{- else -}}
{{- default "default" .serviceAccount.name -}}
{{- end -}}
{{- end -}}