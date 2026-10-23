# Preserve metadata used by Kotlin and annotations while allowing R8 to obfuscate code.
# Avoid broad -keep rules: they disable meaningful obfuscation of the entire app.
-keepattributes Signature,*Annotation*,InnerClasses,EnclosingMethod
