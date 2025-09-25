// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import { Text } from 'react-native';

import BoardScreen from './app/board';
import ChatScreen from './app/chat';
import FindIdScreen from './app/find';
import HomeScreen from './app/home';
import LoginScreen from './app/login';
import ResetPasswordScreen from './app/resetPw';
import ScenarioScreen from './app/scenario';
import SignUpScreen from './app/signup';
import SplashScreen from './app/splash';

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    PretendardRegular: require('./assets/fonts/Regular.ttf'),
    PretendardMedium:  require('./assets/fonts/Medium.ttf'),
    PretendardBold:    require('./assets/fonts/Bold.ttf'),
  });
  if (!fontsLoaded) return null;

  Text.defaultProps = Text.defaultProps || {};
  Text.defaultProps.style = { fontFamily: 'PretendardRegular' };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="FindId" component={FindIdScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Scenario" component={ScenarioScreen} />
        <Stack.Screen name="Board" component={BoardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}