from machine import Pin, I2C, ADC
import ssd1306
import time
from random import randint
import neopixel

def fetch_data():

    return {"xav": [],
            "de smet": [],
            "vds" : [],
            "scalpel" : []}

def fill_random_data():
    for i in prof_array:
        prof_array[i] = [randint(0, 1) for x in range(20)]

def scroll_prof(prof_array, index,direction='up'):
    if direction == 'up':
        index += 1
    else:
        index -= 1

    if index == len(prof_array):
        index = 0
    display.fill_rect(0, 10, 128, 10, 0)
    display.text([key for key in prof_array][index], 0, 10)
    display.show()

    value = list(prof_array.values())[index]
    #print(value)

    convert = {0: (0, 255, 0), 1: (255, 0, 0)}
    for y in range(20):

        x = y * 2

        np[x] = convert[value[y]]
        np[x + 1] = convert[value[y]]

    np.write()

    return index



if '__main__' == __name__ or 1:
    # using default address 0x3C
    i2c = I2C(sda=Pin(0), scl=Pin(1))
    display = ssd1306.SSD1306_I2C(128, 32, i2c)

    prof_array = fetch_data()
    fill_random_data()


    display.rotate(2)

    display.text('Prof: ', 0, 0)
    #display.text([key for key in prof_array][index_prof], 0, 10)

    display.show()

    pot = ADC(28)

    np = neopixel.NeoPixel(Pin(15), 40)
    
    index_prof = scroll_prof(prof_array, -1)

    while True:
        try:
            if pot.read_u16() > 20_000:
                index_prof = scroll_prof(prof_array, index_prof)
                time.sleep(0.5)

        except KeyboardInterrupt:
            for x in range(40):
                np[x] = (0, 0, 0)
                np.write()
                print('wipe strip')