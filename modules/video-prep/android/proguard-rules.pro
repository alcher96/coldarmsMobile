# MediaPipe читает поля своих protobuf-классов и JNI-классы по именам — релизная сборка (R8) не должна их
# переименовывать и вырезать, иначе «Field platform_ for … not found» и поиск людей (PeopleScanner) не работает.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
# журнал MediaPipe (Flogger) ищет вызывающий класс по имени в стеке — без переименования
-keep class com.google.common.flogger.** { *; }
-dontwarn com.google.mediapipe.**
-dontwarn com.google.protobuf.**
-dontwarn com.google.common.flogger.**
