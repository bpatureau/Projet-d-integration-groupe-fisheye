import time

from machine import Pin
import neopixel
from random import randint

row_pins = [Pin(16, Pin.OUT), Pin(17, Pin.OUT), Pin(18, Pin.OUT), Pin(19, Pin.OUT), Pin(20, Pin.OUT)]
col_pins = [Pin(13, Pin.IN, Pin.PULL_UP), Pin(12, Pin.IN, Pin.PULL_UP), Pin(11, Pin.IN, Pin.PULL_UP), Pin(10, Pin.IN, Pin.PULL_UP)]

for pin in row_pins:
    pin.value(0)

print(len(row_pins), len(col_pins))

def scan():

    flag = False

    for pin in col_pins:
        #print(pin.value())
        if not pin.value():
            flag = True
            break
    #print(flag)
    if not flag:
        return None
    print('scan ...')
    for row in row_pins:
        row.value(1)

    for row in range(len(row_pins)):
        row_pins[row].value(0)

        for col in range(len(col_pins)):
            if not col_pins[col].value():
                while not col_pins[col].value():
                    pass
                row_pins[row].value(1)

                for x in row_pins:
                    x.value(0)

                return row + (col + col * len(col_pins))

        row_pins[row].value(1)

    for x in row_pins:
        x.value(0)

    #print('nothing found')

    return None

np = neopixel.NeoPixel(Pin(15), 40)

value = [randint(0, 1) for i in range(20)]

def display():
    for x in range(0, 20):
        y = x * 2
        np[y] = ((255, 0, 0) if value[x] else (0, 255, 0))
        np[y+1] = ((255, 0, 0) if value[x] else (0, 255, 0))
    np.write()
while True:

    b = scan()
    if b is not None:
        value[b] = 0 if value[b] else 1
        display()
        print(value)

    print('\n')
    time.sleep(0.1)