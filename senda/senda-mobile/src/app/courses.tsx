import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, TouchableOpacity, Alert } from 'react-native';

const MICROCOURSES = [
  { id: '1', title: 'Manejo del estrés cotidiano', lessons: 5, color: '#E3F2FD' },
  { id: '2', title: 'Organización y procrastinación', lessons: 8, color: '#E8F5E9' },
  { id: '3', title: 'Hábitos y disciplina', lessons: 7, color: '#F3E5F5' },
  { id: '4', title: 'Comunicación asertiva', lessons: 6, color: '#FFF3E0' },
  { id: '5', title: 'Límites saludables', lessons: 5, color: '#E0F7FA' },
  { id: '6', title: 'Descanso y sueño', lessons: 7, color: '#ECEFF1' },
];

export default function CoursesScreen() {
  const openCourse = (title: string) => {
    // Ejemplo de lección simulada que sigue la estructura pedida
    const lessonContent = `
Módulo 1 de: ${title}

1. Objetivo:
Aprender a identificar cuándo estamos abrumados.

2. Explicación sencilla:
A veces el cuerpo nos avisa antes que la mente. Sentimos tensión, respiración corta o evitamos tareas sencillas.

3. Ejemplo cotidiano:
Posponer contestar un mensaje de un amigo porque se siente como "una tarea más".

4. Ejercicio práctico (2 min):
Cierra los ojos e identifica en qué parte de tu cuerpo hay tensión ahora mismo. Solo obsérvala.

5. Pregunta de reflexión:
¿Qué pequeña cosa podrías soltar o posponer hoy sin que el mundo se caiga?

6. Acción para hoy:
Bebe un vaso con agua lentamente y respira profundo 3 veces.
    `;
    
    Alert.alert(`Microcurso: ${title}`, lessonContent, [{ text: "Completar Lección", style: "default" }]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.headerTitle}>Rutas de Aprendizaje</Text>
        <Text style={styles.subtitle}>Microcursos de 5 minutos al día sin promesas milagrosas. Aprende habilidades a tu propio ritmo.</Text>

        <View style={styles.grid}>
          {MICROCOURSES.map(course => (
            <TouchableOpacity 
              key={course.id} 
              style={[styles.courseCard, { backgroundColor: course.color }]}
              onPress={() => openCourse(course.title)}
            >
              <Text style={styles.courseTitle}>{course.title}</Text>
              <Text style={styles.courseLessons}>{course.lessons} lecciones</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDFBF7' },
  container: { padding: 20 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#1B4965', marginBottom: 5 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 25 },
  
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  courseCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    minHeight: 120,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  courseTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  courseLessons: { fontSize: 12, color: '#555', marginTop: 10 }
});
