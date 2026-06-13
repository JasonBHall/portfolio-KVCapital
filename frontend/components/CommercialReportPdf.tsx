'use client'

import {
  Document, Page, Text, View, StyleSheet, pdf, Image,
} from '@react-pdf/renderer'
import { CommercialValuationReport, CommercialSubjectProperty } from '@/lib/types'

const AMBER  = '#d97706'
const DARK   = '#1e293b'
const MID    = '#475569'
const LIGHT  = '#94a3b8'
const WHITE  = '#ffffff'
const BORDER = '#e2e8f0'
const ROW_ALT = '#f8fafc'
const BLUE   = '#006D94'

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', backgroundColor: WHITE, padding: 40, fontSize: 9, color: DARK },

  // Firm header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  firm: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: DARK },
  firmSub: { fontSize: 8, color: LIGHT, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  reportLabel: { fontSize: 8, color: LIGHT, textTransform: 'uppercase', letterSpacing: 1 },
  reportDate: { fontSize: 9, color: MID, marginTop: 2 },

  // Two-column row
  row2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, border: 1, borderColor: BORDER, borderRadius: 6, padding: 12 },

  // Value card
  subjectAddress: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 10 },
  sectionLabel: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  valueRange: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: DARK },
  midpoint: { fontSize: 9, color: MID, marginTop: 4 },
  midAmt: { color: AMBER, fontFamily: 'Helvetica-Bold' },
  confidenceBadge: { marginTop: 10, fontSize: 8, color: MID },

  // Subject stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER },
  statItem: {},
  statLabel: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', letterSpacing: 0.8 },
  statValue: { fontSize: 9, color: DARK, marginTop: 1 },

  // Flags card
  flagItem: { flexDirection: 'row', gap: 5, marginBottom: 4 },
  flagBullet: { color: AMBER, fontSize: 8, marginTop: 0.5 },
  flagText: { fontSize: 8, color: '#92400e', flex: 1, lineHeight: 1.5 },
  noFlag: { fontSize: 8, color: '#065f46' },

  // Approach reconciliation
  approachCard: { border: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 12 },
  approachRow: { flexDirection: 'row', gap: 24, marginBottom: 8 },
  approachItem: { flex: 1 },
  approachValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK },
  approachLabel: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  approachWeight: { fontSize: 8, color: MID, marginTop: 2 },
  capRateRow: { flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: BORDER },
  capRateItem: {},
  reconciled: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: AMBER },

  // Sensitivity table
  sensitivityCard: { border: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 12 },
  sensitivityHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 4, paddingHorizontal: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  sensitivityRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  sensitivityRowSelected: { backgroundColor: '#fffbeb' },
  sensitivityColRate: { flex: 1 },
  sensitivityColValue: { flex: 1, textAlign: 'right' },
  sensitivityColLabel: { flex: 1, textAlign: 'right' },
  th: { fontSize: 7, color: LIGHT, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  td: { fontSize: 8, color: DARK },
  tdMuted: { fontSize: 8, color: MID },
  tdAmber: { fontSize: 8, color: AMBER, fontFamily: 'Helvetica-Bold' },
  tdSelected: { fontSize: 8, color: AMBER, fontFamily: 'Helvetica-Bold' },

  // Narrative
  narrativeCard: { border: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 12 },
  narrativeText: { fontSize: 9, color: MID, lineHeight: 1.6 },

  // Comp table
  tableWrap: { marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingVertical: 5, paddingHorizontal: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableRowAlt: { backgroundColor: ROW_ALT },
  outlierRow: { backgroundColor: '#fef3c7' },

  colAddr: { flex: 2.2 },
  colNum: { flex: 1, textAlign: 'right' },
  colRate: { flex: 0.9, textAlign: 'right' },

  // Benchmark citation
  benchmarkCard: { border: 1, borderColor: BORDER, borderRadius: 6, padding: 12, marginBottom: 12 },
  benchmarkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  benchmarkPill: { backgroundColor: '#f8fafc', border: 1, borderColor: BORDER, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  pillLabel: { fontSize: 7, color: LIGHT },
  pillValue: { fontSize: 9, color: DARK, fontFamily: 'Helvetica-Bold', marginTop: 1 },

  // Footer
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 8 },
  footerText: { fontSize: 7, color: LIGHT },
})

function fmt(n: number) {
  return `$${n.toLocaleString()}`
}

function fmtRate(r: number) {
  return `${(r * 100).toFixed(2)}%`
}

function fmtSqft(n: number) {
  return `${n.toLocaleString()} sqft`
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
  insufficient: 'Insufficient Data',
}

const ASSET_LABEL: Record<string, string> = {
  industrial: 'Industrial',
  office: 'Office',
  multifamily: 'Multifamily',
}

interface Props {
  report: CommercialValuationReport
  subject?: CommercialSubjectProperty
}

function PdfDocument({ report, subject }: Props) {
  const hasIncome = report.income_approach_value != null && report.cap_rate_applied != null
  const assetLabel = ASSET_LABEL[report.asset_class] ?? report.asset_class

  return (
    <Document title="KV Capital Commercial Valuation Report" author="KV Capital">
      <Page size="LETTER" style={s.page}>

        {/* Firm header */}
        <View style={s.header}>
          <View>
            <Image src={`${window.location.origin}/logo.png`} style={{ height: 28, width: 'auto' }} />
            <Text style={s.firmSub}>Comp Analysis · AI Underwriting Assistant</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.reportLabel}>Commercial Valuation Report</Text>
            <Text style={s.reportDate}>{report.report_date}</Text>
          </View>
        </View>

        {/* Value card + Flags */}
        <View style={s.row2}>

          {/* Value card */}
          <View style={s.card}>
            {subject && (
              <Text style={s.subjectAddress}>{subject.address}, {subject.city}, {subject.province}</Text>
            )}
            <Text style={s.sectionLabel}>Estimated Value</Text>
            {report.confidence === 'insufficient' ? (
              <Text style={{ fontSize: 14, color: '#dc2626', fontFamily: 'Helvetica-Bold' }}>Insufficient Data</Text>
            ) : (
              <>
                <Text style={s.valueRange}>
                  {fmt(report.estimated_value_low)} – {fmt(report.estimated_value_high)}
                </Text>
                <Text style={s.midpoint}>
                  Midpoint: <Text style={s.midAmt}>{fmt(report.estimated_value_mid)}</Text>
                </Text>
              </>
            )}
            <Text style={s.confidenceBadge}>{CONFIDENCE_LABEL[report.confidence] ?? 'Unknown'}</Text>

            {/* Subject stats */}
            {subject && (
              <View style={s.statsGrid}>
                <Stat label="Asset Class" value={assetLabel} />
                {subject.building_class && <Stat label="Class" value={subject.building_class} />}
                <Stat label="Year Built" value={String(subject.year_built)} />
                {subject.gba_sqft && <Stat label="GBA" value={fmtSqft(subject.gba_sqft)} />}
                {subject.nra_sqft && <Stat label="NRA" value={fmtSqft(subject.nra_sqft)} />}
                {subject.num_units && <Stat label="Units" value={String(subject.num_units)} />}
                {subject.noi && <Stat label="NOI" value={fmt(subject.noi)} />}
                {subject.occupancy_pct && <Stat label="Occupancy" value={`${Math.round(subject.occupancy_pct * 100)}%`} />}
                {subject.lease_type && <Stat label="Lease Type" value={{ NNN: 'NNN', gross: 'Gross', modified_gross: 'Modified Gross' }[subject.lease_type] ?? subject.lease_type} />}
              </View>
            )}
          </View>

          {/* Flags */}
          <View style={s.card}>
            <Text style={s.sectionLabel}>Flags</Text>
            {report.flags.length === 0 ? (
              <Text style={s.noFlag}>No flags — clean comp set</Text>
            ) : (
              report.flags.map((flag, i) => (
                <View key={i} style={s.flagItem}>
                  <Text style={s.flagBullet}>!</Text>
                  <Text style={s.flagText}>{flag}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Approach reconciliation */}
        {hasIncome && (
          <View style={s.approachCard}>
            <Text style={s.sectionLabel}>Approach Reconciliation</Text>
            <View style={s.approachRow}>
              <View style={s.approachItem}>
                <Text style={s.approachLabel}>Income Approach (Direct Cap)</Text>
                <Text style={s.approachValue}>{fmt(report.income_approach_value!)}</Text>
                {report.approach_weights && (
                  <Text style={s.approachWeight}>Weight: {Math.round(report.approach_weights.income * 100)}%</Text>
                )}
              </View>
              <View style={s.approachItem}>
                <Text style={s.approachLabel}>Sales Comparison</Text>
                <Text style={s.approachValue}>{fmt(report.estimated_value_mid)}</Text>
                {report.approach_weights && (
                  <Text style={s.approachWeight}>Weight: {Math.round(report.approach_weights.sales_comparison * 100)}%</Text>
                )}
              </View>
              <View style={s.approachItem}>
                <Text style={s.approachLabel}>Reconciled Value</Text>
                <Text style={s.reconciled}>{fmt(report.estimated_value_mid)}</Text>
              </View>
            </View>
            <View style={s.capRateRow}>
              {report.cap_rate_applied && (
                <View style={s.capRateItem}>
                  <Text style={s.statLabel}>Cap Rate Applied</Text>
                  <Text style={[s.statValue, { fontFamily: 'Helvetica-Bold' }]}>{fmtRate(report.cap_rate_applied)}</Text>
                </View>
              )}
              {report.cap_rate_range_low != null && report.cap_rate_range_high != null && (
                <View style={s.capRateItem}>
                  <Text style={s.statLabel}>Benchmark Lane</Text>
                  <Text style={s.statValue}>{fmtRate(report.cap_rate_range_low)} – {fmtRate(report.cap_rate_range_high)}</Text>
                </View>
              )}
              {report.cap_rate_source && (
                <View style={s.capRateItem}>
                  <Text style={s.statLabel}>Source</Text>
                  <Text style={s.statValue}>{report.cap_rate_source}</Text>
                </View>
              )}
            </View>
            {report.approach_rationale && (
              <Text style={[s.narrativeText, { marginTop: 8 }]}>{report.approach_rationale}</Text>
            )}
          </View>
        )}

        {/* Sensitivity table */}
        {report.sensitivity_table && report.sensitivity_table.length > 0 && (
          <View style={s.sensitivityCard}>
            <Text style={s.sectionLabel}>Cap Rate Sensitivity</Text>
            <View style={s.sensitivityHeader}>
              <Text style={[s.th, s.sensitivityColRate]}>Cap Rate</Text>
              <Text style={[s.th, s.sensitivityColValue]}>Implied Value</Text>
              <Text style={[s.th, s.sensitivityColLabel]}>Scenario</Text>
            </View>
            {report.sensitivity_table.map((row, i) => {
              const isSelected = row.label === 'Selected'
              return (
                <View key={i} style={[s.sensitivityRow, isSelected ? s.sensitivityRowSelected : i % 2 === 1 ? { backgroundColor: ROW_ALT } : {}]}>
                  <Text style={[isSelected ? s.tdSelected : s.tdMuted, s.sensitivityColRate]}>{fmtRate(row.cap_rate)}</Text>
                  <Text style={[isSelected ? s.tdAmber : s.td, s.sensitivityColValue]}>{fmt(row.value)}</Text>
                  <Text style={[isSelected ? s.tdSelected : s.tdMuted, s.sensitivityColLabel]}>{row.label}</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Narrative */}
        {report.narrative && (
          <View style={s.narrativeCard}>
            <Text style={s.sectionLabel}>Valuation Summary</Text>
            <Text style={s.narrativeText}>{report.narrative}</Text>
          </View>
        )}

        {/* Comparable Sales table */}
        {report.comps.length > 0 && (
          <View style={s.tableWrap}>
            <Text style={[s.sectionLabel, { marginBottom: 6 }]}>
              Comparable Sales ({report.comps.length})
            </Text>
            <View style={s.tableHeader}>
              <Text style={[s.th, s.colAddr]}>Address</Text>
              <Text style={[s.th, s.colNum]}>Sale Price</Text>
              <Text style={[s.th, s.colNum]}>Adj. Price</Text>
              <Text style={[s.th, s.colNum]}>GBA / Units</Text>
              <Text style={[s.th, s.colRate]}>Cap Rate</Text>
              <Text style={[s.th, s.colRate]}>Adj %</Text>
              <Text style={[s.th, s.colNum]}>Dist (km)</Text>
            </View>
            {report.comps.map((comp, i) => (
              <View
                key={comp.id}
                style={[
                  s.tableRow,
                  i % 2 === 1 ? s.tableRowAlt : {},
                  comp.is_outlier ? s.outlierRow : {},
                ]}
              >
                <Text style={[s.td, s.colAddr]}>
                  {comp.address}{comp.is_outlier ? ' [outlier]' : ''}
                </Text>
                <Text style={[s.tdMuted, s.colNum]}>{fmt(comp.sale_price)}</Text>
                <Text style={[s.tdAmber, s.colNum]}>{fmt(comp.adjusted_price)}</Text>
                <Text style={[s.tdMuted, s.colNum]}>
                  {comp.gba_sqft ? `${comp.gba_sqft.toLocaleString()} sf` : comp.num_units ? `${comp.num_units} units` : '—'}
                </Text>
                <Text style={[comp.implied_cap_rate != null ? s.tdMuted : s.tdMuted, s.colRate]}>
                  {comp.implied_cap_rate != null ? fmtRate(comp.implied_cap_rate) : '—'}
                </Text>
                <Text style={[comp.is_outlier ? s.tdAmber : s.tdMuted, s.colRate]}>
                  {comp.adjustments.total_pct.toFixed(1)}%
                </Text>
                <Text style={[s.tdMuted, s.colNum]}>{comp.distance_km.toFixed(1)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Benchmark citation */}
        <View style={s.benchmarkCard}>
          <Text style={s.sectionLabel}>Benchmarks & Sources</Text>
          <View style={s.benchmarkGrid}>
            {report.cap_rate_range_low != null && report.cap_rate_range_high != null && (
              <Pill label="Cap Rate Lane" value={`${fmtRate(report.cap_rate_range_low)} – ${fmtRate(report.cap_rate_range_high)}`} />
            )}
            {report.cap_rate_applied != null && (
              <Pill label="Cap Rate Applied" value={fmtRate(report.cap_rate_applied)} />
            )}
            {report.adjustment_rates?.outlier_threshold_pct != null && (
              <Pill label="Outlier Threshold" value={`${report.adjustment_rates.outlier_threshold_pct}%`} />
            )}
            <Pill label="Cap Rate Source" value={report.cap_rate_source ?? 'Altus Group Q4 2024'} />
            <Pill label="Methodology" value="CUSPAP — AIC" />
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Confidential — prepared for internal use · KV Capital</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.statItem}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.benchmarkPill}>
      <Text style={s.pillLabel}>{label}</Text>
      <Text style={s.pillValue}>{value}</Text>
    </View>
  )
}

export async function downloadCommercialPdf(
  report: CommercialValuationReport,
  subject?: CommercialSubjectProperty,
) {
  const blob = await pdf(<PdfDocument report={report} subject={subject} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `kv-capital-commercial-${report.report_date.replace(/\s/g, '-')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
