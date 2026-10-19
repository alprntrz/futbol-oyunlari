// Messages between the Tiktako app and the game. The app talks to the "RushGame" object
// (UnitySendMessage → RushGame.Cmd / RushGame.Swipe); the game answers with JSON strings through
// @azesmway/react-native-unity (NativeCallProxy on iOS, ReactNativeUnityViewManager on Android).
using System;
using UnityEngine;
#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace Rush
{
    public static class Bridge
    {
#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        static extern void sendMessageToMobileApp(string message);
#endif
#if UNITY_ANDROID && !UNITY_EDITOR
        static AndroidJavaClass android;
#endif
        /// <summary>In the editor the messages go to the log (and to this hook, for tests).</summary>
        public static Action<string> EditorSink;

        public static void Send(string msg)
        {
            try
            {
#if UNITY_IOS && !UNITY_EDITOR
                sendMessageToMobileApp(msg);
#elif UNITY_ANDROID && !UNITY_EDITOR
                if (android == null) android = new AndroidJavaClass("com.azesmwayreactnativeunity.ReactNativeUnityViewManager");
                android.CallStatic("sendMessageToMobileApp", msg);
#else
                if (EditorSink != null) EditorSink(msg);
                else Debug.Log("→ app: " + msg);
#endif
            }
            catch (Exception e)
            {
                Debug.LogWarning("Bridge.Send failed: " + e.Message);
            }
        }
    }

    /// <summary>What the app sends (one shape for every command; unused fields stay empty).</summary>
    [Serializable]
    public class AppMsg
    {
        /// <summary>"ping" | "start" | "menu" | "pause" | "resume"</summary>
        public string t;
        public int seed;
        /// <summary>the favourite club's kit (hex colours) and the shirt number</summary>
        public string body, sleeves, num;
        /// <summary>right-answer lanes (-1, 0, 1), one per goal question, and the three options per goal (left to right)</summary>
        public int[] answers;
        public GoalOptions[] goals;
    }

    [Serializable]
    public class GoalOptions
    {
        public string[] lanes;
    }
}
