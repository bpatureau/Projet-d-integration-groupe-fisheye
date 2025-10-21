from machine import Pin, I2C, ADC

import matrice_button
import ssd1306
import time
from random import randint
import neopixel


def fetch_data():
    return [{"name": "xav", "data": []},
            {"name": "de smet", "data": []},
            {"name": "vds", "data": []},
            {"name": "scalpel", "data": []}]


def fill_random_data():
    for i in prof_array:
        i['data'] = [randint(0, 1) for x in range(20)]


def scroll_prof(direction='up'):
    global prof_array, index

    if direction == 'up':
        index += 1
        if index >= len(prof_array):
            index = 0
    else:
        index -= 1
        if index < 0:
            index = 0

    display.fill_rect(0, 10, 128, 10, 0)
    display.text(prof_array[index]['name'], 0, 10)
    display.show()

    update_strip()


def update_strip():
    global prof_array, index

    for x in range(20):
        y = x * 2

        convert = {0: (255, 0, 0), 1: (0, 255, 0)}
        # print(convert[data[i_index]['data'][x]])
        np[y] = convert[prof_array[index]['data'][x]]
        np[y + 1] = convert[prof_array[index]['data'][x]]

    np.write()


def button_press(b_index):
    if b_index is not None:
        print('button press')
        print(prof_array[index]['data'][b_index])

        prof_array[index]['data'][b_index] = 1 if prof_array[index]['data'][b_index] == 0 else 0

        print(prof_array[index]['data'][b_index])

        update_strip()


prof_array = fetch_data()
fill_random_data()
index = 0

print(prof_array)

i2c = I2C(sda=Pin(0), scl=Pin(1))
display = ssd1306.SSD1306_I2C(128, 32, i2c)

display.text('Prof: ', 0, 0)

display.show()

pot = ADC(28)

np = neopixel.NeoPixel(Pin(15), 40)

row_pins = [Pin(16, Pin.OUT), Pin(17, Pin.OUT), Pin(18, Pin.OUT), Pin(19, Pin.OUT),
            Pin(20, Pin.OUT)]
col_pins = [Pin(13, Pin.IN, Pin.PULL_UP), Pin(12, Pin.IN, Pin.PULL_UP), Pin(11, Pin.IN, Pin.PULL_UP),
            Pin(10, Pin.IN, Pin.PULL_UP)]

matrice = matrice_button.ButtonMatrix(row_pins, col_pins, button_press)

matrice.scan()

while True:

    if pot.read_u16() > 20_000:
        scroll_prof()
        time.sleep(0.5)
    matrice.scan()

