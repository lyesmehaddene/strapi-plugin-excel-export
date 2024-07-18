"use strict";
const ExcelJS = require("exceljs");

module.exports = ({ strapi }) => ({
  async getDropDownData() {
    let excel = strapi.config.get("excel");
    let dropDownValues = [];
    let array = Object.keys(excel?.config);

    strapi?.db?.config?.models?.forEach((element) => {
      if (element?.kind == "collectionType") {
        array?.forEach((data) => {
          if (element?.uid?.startsWith(data)) {
            dropDownValues.push({
              label: element?.info?.displayName,
              value: element?.uid,
            });
          }
        });
      }
    });
    // Sort dropDownValues alphabetically by label in ascending order
    dropDownValues.sort((a, b) => a.label.localeCompare(b.label));

    return {
      data: dropDownValues,
    };
  },
  async getTableData(ctx) {
    let excel = strapi.config.get("excel");
    let uid = ctx?.query?.uid;
    let limit = ctx?.query?.limit;
    let offset = ctx?.query?.offset;
    let query = await this.restructureObject(
      excel?.config[uid],
      uid,
      limit,
      offset
    );

    let response = await strapi.db.query(uid).findMany(query);

    let header = [
      ...excel?.config[uid]?.columns,
      ...Object.keys(excel?.config[uid]?.relation),
    ];

    let where = {};

    if (excel?.config[uid]?.locale == "true") {
      where = {
        locale: "en",
      };
    }

    let count = await strapi.db.query(uid).count(where);

    let tableData = await this.restructureData(response, excel?.config[uid]);

    // Sort dropDownValues alphabetically by label in ascending order

    return {
      data: tableData,
      count: count,
      columns: header,
    };
  },

  async downloadExcel(ctx) {
    try {
      let excel = strapi.config.get("excel");
      let uid = ctx?.query?.uid;
      let query = await this.restructureObject(excel?.config[uid], uid);
      let response = await strapi.db.query(uid).findMany(query);
      let excelData = await this.restructureData(response, excel?.config[uid]);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Sheet 1");

      // Format headers

      let headers = [...excel?.config[uid]?.columns, ...Object.keys(excel?.config[uid]?.relation)];
      worksheet.columns = headers.map(header => ({
        header: header.replace(/_/g, " ").replace(/\b\w/g, char => char.toUpperCase()),
        key: header,
        width: 20
      }));

      // Add data to the worksheet

      excelData.forEach(row => {
        worksheet.addRow(row);
      });

      worksheet.columns.forEach(column => {
        column.alignment = { wrapText: true };
      });

      worksheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2" }];

      return await workbook.xlsx.writeBuffer();

    } catch (error) {
      console.error("Error writing buffer:", error);
    }
  },

  async restructureObject(inputObject, uid, limit, offset) {
    let excel = strapi.config.get("excel");

    let where = {};

    if (excel?.config[uid]?.locale == "true") {
      where = {
        locale: "en",
      };
    }
    let orderBy = {
      id: "asc",
    };

    const restructuredObject = {
      select: inputObject.columns || "*",
      populate: {},
      where,
      orderBy,
      limit: limit,
      offset: offset,
    };

    for (const key in inputObject.relation) {
      restructuredObject.populate[key] = {
        select: inputObject.relation[key].column,
      };
    }

    return restructuredObject;
  },
  async restructureData(data, objectStructure) {
    return data.map((item) => {
      const restructuredItem = {};

      // Restructure main data based on columns
      for (const key of objectStructure.columns) {
        if (key in item) {
          restructuredItem[key] = item[key];
        }
      }

      // Restructure relation data based on the specified structure
      for (const key in objectStructure.relation) {
        if (key in item) {
          const column = objectStructure.relation[key].column[0];
          if (item[key] && typeof item[key] === "object") {
            if (Array.isArray(item[key]) && item[key].length > 0) {
              restructuredItem[key] = item[key]
                .map((obj) => obj[column])
                .join(" ");
            } else {
              restructuredItem[key] = item[key][column];
            }
          } else {
            // Handle the case where item[key] is not an object
            restructuredItem[key] = null; // Or handle it as needed
          }
        }
      }

      return restructuredItem;
    });
  },
});
