<?php
include_once '../config/config.php';

// Configuramos los datos
$usuario = 'NicolasGonzalez'; // <--- Elige tu usuario aquí
$password = 'almendra'; // <--- Tu clave elegida
$nombre = 'Nicolas Gonzalez';

// Generamos el hash oficial del servidor
$hash_seguro = password_hash($password, PASSWORD_BCRYPT);

try {
    // Limpiamos la tabla para no tener duplicados (OPCIONAL)
    $conn->query("DELETE FROM usuarios");

    // Insertamos el usuario con el hash fresco
    $stmt = $conn->prepare("INSERT INTO usuarios (usuario, password, nombre) VALUES (?, ?, ?)");
    $stmt->execute([$usuario, $hash_seguro, $nombre]);

    echo "✅ Usuario '$usuario' creado exitosamente con la clave '$password'.<br>";
    echo "🔐 Hash generado: " . $hash_seguro;
} catch (PDOException $e) {
    echo "❌ Error: " . $e->getMessage();
}
?>