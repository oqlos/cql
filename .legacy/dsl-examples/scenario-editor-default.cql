SCENARIO: dsl-editor
GOAL: Wytworzyć podciśnienie
  SET 'pompa 1' '1'
  IF 'Czujnik Ciśnienia 1' > '1 mbar'
  SET 'zawór 1' '1'