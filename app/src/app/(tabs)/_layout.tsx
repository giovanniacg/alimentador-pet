import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router/js-tabs';

import { colors, fontSizes } from '@/theme';

/**
 * Tres abas, rotulo sempre visivel e icone grande.
 * Rotulo escrito importa mais que icone bonito para quem usa pouco celular.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: fontSizes.small, fontWeight: '700' },
        tabBarStyle: {
          height: 86,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <MaterialIcons name="pets" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Horários',
          tabBarIcon: ({ color }) => <MaterialIcons name="schedule" size={30} color={color} />,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color }) => <MaterialIcons name="list-alt" size={30} color={color} />,
        }}
      />
    </Tabs>
  );
}
