import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 64, fontFamily: "Helvetica", fontSize: 11, color: "#111" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 24 },
  subtitle: { fontSize: 10, color: "#666", textAlign: "center", marginBottom: 24 },
  section: { marginBottom: 12, lineHeight: 1.5 },
  signatureBlock: { marginTop: 48 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#000", width: 240, marginBottom: 4 },
  small: { fontSize: 9, color: "#666", marginTop: 32 },
});

export interface NoticePdfProps {
  title: string;
  body: string;
  citation?: string | null;
  landlordName: string;
  todayLabel: string;
  identityFooter?: string;
}

export function NoticePdf({ title, body, citation, landlordName, todayLabel, identityFooter }: NoticePdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {citation ? <Text style={styles.subtitle}>{citation}</Text> : null}

        <View style={styles.section}>
          {body.split(/\n\n+/).map((para, i) => (
            <Text key={i} style={{ marginBottom: 10 }}>{para}</Text>
          ))}
        </View>

        <View style={styles.signatureBlock}>
          <Text>Dated: {todayLabel}</Text>
          <View style={{ marginTop: 24 }}>
            <View style={styles.rule} />
            <Text>{landlordName}, Landlord</Text>
          </View>
        </View>

        {identityFooter ? <Text style={styles.small}>{identityFooter}</Text> : null}
      </Page>
    </Document>
  );
}
