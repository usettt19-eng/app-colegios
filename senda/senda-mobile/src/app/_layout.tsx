import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen 
          name="chat" 
          options={{ 
            title: 'NOVA', 
            presentation: 'modal', 
            headerStyle: { backgroundColor: '#FDFBF7' },
            headerTintColor: '#1B4965'
          }} 
        />
        <Stack.Screen 
          name="journal" 
          options={{ 
            title: 'Diario', 
            headerStyle: { backgroundColor: '#FDFBF7' },
            headerTintColor: '#1B4965'
          }} 
        />
        <Stack.Screen 
          name="courses" 
          options={{ 
            title: 'Aprender', 
            headerStyle: { backgroundColor: '#FDFBF7' },
            headerTintColor: '#1B4965'
          }} 
        />
      </Stack>
    </>
  );
}
