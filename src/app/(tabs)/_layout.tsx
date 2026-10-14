import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="athletes" />
      <Tabs.Screen name="tournaments" />
      <Tabs.Screen name="analysis" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
