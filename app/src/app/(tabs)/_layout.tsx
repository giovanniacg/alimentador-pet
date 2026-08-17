import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, control, fontCap, iconSize, radius } from '@/theme';

/**
 * Quatro abas, rotulo sempre visivel e icone grande.
 * Rotulo escrito importa mais que icone bonito para quem usa pouco celular.
 * As tres primeiras sao o dia a dia dos pais; "Ajustes" e a administracao
 * remota do Giovanni.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        // Aba ativa nao se distingue so por cor: ganha fundo proprio.
        tabBarActiveBackgroundColor: colors.blueSurface,
        tabBarAllowFontScaling: true,
        /**
         * 14 dp e a unica excecao ao piso de 16 do app, e e consciente: o alvo
         * de toque continua sendo a celula inteira (64 dp de altura), e
         * truncar "Histórico" custaria mais legibilidade do que os 2 dp.
         */
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '700',
        },
        // Teto de 1.2 no rotulo: acima disso "Histórico" nao cabe em um quarto
        // da largura e o sistema trunca com reticencias.
        tabBarLabel: ({ color, children }) => (
          <Text
            style={[styles.tabLabel, { color }]}
            maxFontSizeMultiplier={fontCap.tab}
            numberOfLines={1}>
            {children}
          </Text>
        ),
        tabBarItemStyle: {
          borderRadius: radius.md,
          paddingTop: 4,
          paddingBottom: 4,
        },
        // Altura fixa ignorava a barra de gestos: em Android edge-to-edge e no
        // iPhone, o rotulo ficava por baixo dela.
        tabBarStyle: {
          height: control.xl + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <MaterialIcons name="pets" size={iconSize.lg} color={color} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Horários',
          tabBarIcon: ({ color }) => <MaterialIcons name="schedule" size={iconSize.lg} color={color} />,
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color }) => <MaterialIcons name="list-alt" size={iconSize.lg} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={iconSize.lg} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
