#!/bin/bash

# Fonction pour vérifier si tous les nœuds sont prêts
check_nodes_ready() {
  # Tableau des nœuds MongoDB
  nodes=("mongodb1:27017" "mongodb2:27017" "mongodb3:27017")

  # Boucle pour vérifier chaque nœud
  for node in "${nodes[@]}"; do
    host=${node%:*}
    port=${node#*:}

    # Essayer de se connecter au nœud
    if ! mongo --host "$host" --port "$port" --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
      echo "Node $node is not ready"
      return 1
    fi
  done

  # Si tous les nœuds sont prêts, retourner 0
  return 0
}

# Fonction principale
main() {
  # Attendre que tous les nœuds soient prêts
  echo "Waiting for MongoDB nodes to be ready..."
  while true; do
    if check_nodes_ready; then
      echo "All MongoDB nodes are ready."
      break
    fi
    sleep 5
  done

  # Initialiser le réplica set
  echo "Initializing replica set..."
  mongo --host mongodb1 --port 27017 /docker-entrypoint-initdb.d/init-replset.js
}

# Exécuter la fonction principale
main