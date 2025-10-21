from machine import Pin
import time


class ButtonMatrix:
    def __init__(self, row_pins: list, col_pins: list, callback):
        """
        Initialize button matrix scanner.

        Args:
            row_pins: list of Pin objects for rows (configured as outputs)
            col_pins: list of Pin objects for columns (configured as inputs with pull-down)
            callback: function called with button index (0 to rows*cols-1) when pressed
        """
        self.rows = row_pins
        self.cols = col_pins
        self.num_rows = len(row_pins)
        self.num_cols = len(col_pins)
        self.callback = callback

        # Configure row pins as outputs (set HIGH initially)
        for pin in self.rows:
            pin.init(Pin.OUT)
            pin.value(1)

        # Configure column pins as inputs with pull-down resistors
        for pin in self.cols:
            pin.init(Pin.IN, Pin.PULL_UP)

    def scan(self):
        """Scan the matrix once and call callback if button pressed."""

        button_index = None

        for row in self.rows:
            row.value(1)

        for row_idx, row_pin in enumerate(self.rows):
            # Activate current row (set LOW)
            row_pin.value(0)

            # Small delay to let signal stabilize
            time.sleep_us(10)

            # Check each column
            for col_idx, col_pin in enumerate(self.cols):
                if col_pin.value() == 0:  # Button pressed (LOW detected)

                    while col_pin.value() == 0:
                        pass

                    # Calculate button index
                    button_index = row_idx + (col_idx + col_idx * self.num_cols)

            # Deactivate row (set back to HIGH)
            row_pin.value(1)

        for row in self.rows:
            row.value(0)

        self.callback(button_index)


    def scan_continuous(self, delay_ms: int = 10):
        """Continuously scan the matrix in a loop."""
        while True:
            self.scan()
            time.sleep_ms(delay_ms)
