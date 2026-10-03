import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<number | null>(null);

  const handleHelpButton = () => {
    Alert.alert(
      "Centro de Seguridad",
      "Línea de Crisis Local: 135\nEmergencias Médicas: 911\n\nPor favor, busca apoyo profesional de inmediato si sientes que no puedes mantenerte a salvo.",
      [{ text: "Entendido", style: "cancel" }]
    );
  };

  const submitMood = (moodValue: number) => {
    setSelectedMood(moodValue);
    // TODO: Enviar al backend
    Alert.alert("Registro guardado", "Gracias por registrar cómo te sientes hoy.");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header con botón de Emergencia */}
        <View style={styles.header}>
          <Text style={styles.logo}>Senda</Text>
          <TouchableOpacity style={styles.helpButton} onPress={handleHelpButton}>
            <Text style={styles.helpButtonText}>🆘 Necesito ayuda</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.greeting}>Hola, ¿Cómo te sientes hoy?</Text>

        {/* Check-in de Ánimo */}
        <View style={styles.moodContainer}>
          {[
            { label: 'Muy Mal', emoji: '😞', value: 1 },
            { label: 'Mal', emoji: '🙁', value: 2 },
            { label: 'Neutral', emoji: '😐', value: 3 },
            { label: 'Bien', emoji: '🙂', value: 4 },
            { label: 'Muy Bien', emoji: '😄', value: 5 }
          ].map((mood) => (
            <TouchableOpacity 
              key={mood.value} 
              style={[styles.moodItem, selectedMood === mood.value && styles.moodItemSelected]}
              onPress={() => submitMood(mood.value)}
            >
              <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              <Text style={styles.moodLabel}>{mood.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Atajos Rápidos */}
        <Text style={styles.sectionTitle}>Atajos rápidos</Text>
        <View style={styles.shortcutsContainer}>
          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/chat')}>
            <Text style={styles.shortcutIcon}>🤖</Text>
            <Text style={styles.shortcutTitle}>Hablar con NOVA</Text>
            <Text style={styles.shortcutDesc}>Asistente de bienestar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shortcutCard} onPress={() => router.push('/journal')}>
            <Text style={styles.shortcutIcon}>📝</Text>
            <Text style={styles.shortcutTitle}>Diario Guiado</Text>
            <Text style={styles.shortcutDesc}>Reflexiona sobre tu día</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shortcutCard, { width: '100%', marginTop: 15, backgroundColor: '#FFF3E0' }]} onPress={() => router.push('/courses')}>
            <Text style={styles.shortcutIcon}>📚</Text>
            <Text style={[styles.shortcutTitle, { color: '#E65100' }]}>Rutas de Aprendizaje</Text>
            <Text style={[styles.shortcutDesc, { color: '#EF6C00' }]}>Microcursos de 5 minutos</Text>
          </TouchableOpacity>
        </View>

        {/* Hábitos del Día */}
        <Text style={styles.sectionTitle}>Tus hábitos de hoy</Text>
        <View style={styles.habitsContainer}>
          <View style={styles.habitRow}>
            <View style={styles.checkbox} />
            <Text style={styles.habitText}>Respirar 2 minutos</Text>
          </View>
          <View style={styles.habitRow}>
            <View style={styles.checkbox} />
            <Text style={styles.habitText}>Beber agua</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDFBF7' }, // Blanco cálido
  container: { padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10
  },
  logo: { fontSize: 28, fontWeight: 'bold', color: '#1B4965' }, // Azul petróleo
  helpButton: {
    backgroundColor: '#FFE5E5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFCCCC'
  },
  helpButtonText: { color: '#D80000', fontWeight: '600', fontSize: 13 },
  greeting: { fontSize: 24, fontWeight: '600', color: '#1B4965', marginBottom: 20 },
  
  moodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 35
  },
  moodItem: { alignItems: 'center', padding: 10, borderRadius: 10 },
  moodItemSelected: { backgroundColor: '#E3F2FD' },
  moodEmoji: { fontSize: 30, marginBottom: 5 },
  moodLabel: { fontSize: 12, color: '#666' },

  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1B4965', marginBottom: 15 },
  shortcutsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 35
  },
  shortcutCard: {
    backgroundColor: '#E8F5E9', // Verde salvia claro
    width: '48%',
    padding: 15,
    borderRadius: 15,
    alignItems: 'center'
  },
  shortcutIcon: { fontSize: 32, marginBottom: 10 },
  shortcutTitle: { fontSize: 14, fontWeight: '600', color: '#2E7D32', marginBottom: 4 },
  shortcutDesc: { fontSize: 11, color: '#4CAF50', textAlign: 'center' },

  habitsContainer: { backgroundColor: '#FFF', borderRadius: 15, padding: 15 },
  habitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#9C88FF', // Acento lavanda
    marginRight: 12
  },
  habitText: { fontSize: 16, color: '#333' }
});
