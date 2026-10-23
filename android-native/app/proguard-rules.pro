# Keep only runtime-reflected / serialized types that need stable names.
# R8 performs release shrinking and obfuscation; never place secrets here.
-keepattributes Signature,*Annotation*
-keep class org.tege.messenger.** { *; }
